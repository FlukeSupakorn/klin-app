# llama-server Lifecycle Management

## ภาพรวม

`llama-server` เป็น sidecar process ที่รัน llama.cpp HTTP inference server ภายใน Tauri app
การจัดการ lifecycle ทั้งหมดอยู่ใน [`src-tauri/src/sidecars/llama_server.rs`](../src-tauri/src/sidecars/llama_server.rs)

---

## State Machine — `LaunchPhase`

```
Idle / Crashed  ──(spawn attempt)──►  Starting
Starting        ──(TCP ready)──────►  Running
Starting        ──(crash/timeout)──►  Crashed
Running         ──(TCP probe fail)──► Crashed
Running         ──(stop/idle kill)──► Idle
Crashed         ──(next caller)────►  Starting  (retry)
```

```rust
pub enum LaunchPhase {
    Idle,           // ยังไม่ start หรือ stop ไปแล้ว
    Starting,       // กำลัง spawn อยู่ ยังไม่ฟัง TCP
    Running,        // TCP port เปิดแล้ว พร้อมรับ request
    Crashed(String),// process ตายไป หรือ spawn ล้มเหลว
}
```

State นี้เก็บไว้ใน `AppState` พร้อม `Condvar` เพื่อให้ concurrent callers รอได้อย่าง
ปลอดภัยโดยไม่ต้อง busy-wait

---

## AppState ที่เกี่ยวข้อง

```rust
pub struct AppState {
    pub llama_server_child:           Arc<Mutex<Option<CommandChild>>>,
    pub llama_last_used:              Arc<Mutex<Option<Instant>>>,
    pub llama_phase:                  Arc<Mutex<LaunchPhase>>,
    pub llama_phase_condvar:          Arc<Condvar>,
    pub llama_stop_requested:         Arc<AtomicBool>,
    pub llama_idle_shutdown:          Arc<Mutex<bool>>,
    pub llama_idle_shutdown_condvar:  Arc<Condvar>,
    // ...
}
```

| Field | หน้าที่ |
|---|---|
| `llama_server_child` | handle ของ process ที่รันอยู่ |
| `llama_last_used` | timestamp ของการใช้งานล่าสุด ใช้โดย idle timer |
| `llama_phase` | state ปัจจุบัน |
| `llama_phase_condvar` | wake up callers ที่รออยู่เมื่อ phase เปลี่ยน |
| `llama_stop_requested` | ป้องกัน respawn หลัง explicit stop (ไม่ set โดย idle timer) |
| `llama_idle_shutdown` | สัญญาณ shutdown สำหรับ idle-timeout thread |
| `llama_idle_shutdown_condvar` | ปลุก idle-timeout thread ให้ออกทันทีเมื่อ app ปิด |

---

## ฟังก์ชันหลัก

### 1. `ensure_llama_server_running` — เริ่ม / ยืนยัน server

ฟังก์ชันนี้เป็น entry point หลักสำหรับทุก AI request
ทำงานใน loop เพื่อ handle concurrent callers อย่างปลอดภัย

```rust
pub fn ensure_llama_server_running<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    state: &AppState,
) -> Result<(), String>
```

**พฤติกรรมตาม phase:**

| Phase | การทำงาน |
|---|---|
| `Running` | TCP probe → อัปเดต `last_used` → return OK |
| `Starting` | รอบน Condvar จนกว่า phase จะเปลี่ยน |
| `Idle` / `Crashed` | ตรวจ `stop_requested` → ถ้า true return Err → ไม่งั้น claim `Starting` → spawn ใหม่ → poll TCP → `Running` |

ที่จุดเริ่มต้นของฟังก์ชัน จะ clear `stop_requested` flag เพื่อให้ caller ใหม่
สามารถ spawn server ได้ตามปกติ

```rust
// ตัวอย่างการใช้งานในฝั่ง Rust (Tauri command)
#[tauri::command]
pub fn ensure_llama_server<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<AppState>,
) -> Result<(), String> {
    crate::sidecars::ensure_llama_server_running(&app, state.inner())
}
```

---

### 2. `spawn_llama_server` — spawn process จริง

อ่าน env vars แล้ว spawn sidecar พร้อม async monitor
ที่คอย set phase → `Crashed` เมื่อ process ตาย

```rust
pub fn spawn_llama_server<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    phase: Arc<Mutex<LaunchPhase>>,
    condvar: Arc<Condvar>,
) -> Result<CommandChild, String>
```

**async termination monitor** ที่ทำงานหลัง spawn:

```rust
tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Terminated(payload) => {
                let mut p = phase.lock();
                // ไม่ overwrite Idle (กรณี stop ตั้งใจ)
                if !matches!(*p, LaunchPhase::Idle) {
                    *p = LaunchPhase::Crashed(
                        format!("process terminated (code: {:?})", payload.code)
                    );
                }
                condvar.notify_all(); // ปลุก callers ที่รออยู่
                break;
            }
            // ...
        }
    }
});
```

---

### 3. `touch_llama_last_used` — refresh idle timer

อัปเดต `last_used` โดยไม่ทำ TCP probe
ใช้เพื่อป้องกัน idle timer ฆ่า server ระหว่าง long-running request
เช่น SSE streaming ที่ใช้เวลานาน

```rust
pub fn touch_llama_last_used(state: &AppState) {
    let phase = state.llama_phase.lock();
    if matches!(*phase, LaunchPhase::Running) {
        *state.llama_last_used.lock() = Some(Instant::now());
    }
}
```

---

### 4. `stop_llama_server_process` — หยุด server

ตั้ง `stop_requested = true` ก่อน kill เพื่อป้องกัน concurrent callers
ที่กำลังรอบน Condvar จาก respawn server ทันทีหลัง stop

```rust
pub fn stop_llama_server_process(state: &AppState) {
    state.llama_stop_requested.store(true, Ordering::SeqCst);
    super::kill_sidecar("llama-server", &state.llama_server_child);
    *state.llama_phase.lock() = LaunchPhase::Idle;
    state.llama_phase_condvar.notify_all();
    *state.llama_last_used.lock() = None;
}
```

> **หมายเหตุ**: idle timer ไม่ set `stop_requested` — เมื่อ idle timer kill server
> แล้ว request ใหม่เข้ามา server จะถูก spawn ใหม่ตามปกติ

---

### 5. `spawn_idle_timeout_task` — auto-stop เมื่อ idle

Background thread ที่ poll ทุก 30 วินาที
หาก `last_used` เกิน timeout (default 300s = 5 นาที) จะหยุด server อัตโนมัติ

รองรับ **graceful shutdown** ผ่าน `shutdown` condvar —
เมื่อ app ปิด จะปลุก thread ให้ออกทันทีแทนที่จะรออีก 30 วินาที

```rust
pub fn spawn_idle_timeout_task(
    child_slot:       Arc<Mutex<Option<CommandChild>>>,
    last_used:        Arc<Mutex<Option<Instant>>>,
    phase:            Arc<Mutex<LaunchPhase>>,
    condvar:          Arc<Condvar>,
    shutdown:         Arc<Mutex<bool>>,
    shutdown_condvar: Arc<Condvar>,
)
```

```
ทุก 30 วินาที (หรือเมื่อถูกปลุกจาก shutdown signal):
  shutdown == true      → break ออกจาก loop, log "[idle-timer] shutdown — exiting"
  last_used == None     → ไม่ทำอะไร (server ยังไม่ถูกใช้)
  elapsed > timeout     → set Idle → kill child → clear last_used
  elapsed ≤ timeout     → ไม่ทำอะไร
```

**App exit handler** ที่ trigger shutdown:

```rust
.run(|app, event| {
    if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
        let state = app.state::<AppState>();
        *state.llama_idle_shutdown.lock() = true;
        state.llama_idle_shutdown_condvar.notify_all();
        sidecars::cleanup_all(app);
    }
});
```

---

### 6. `tcp_probe_timeout` — configurable TCP probe

TCP connect timeout สำหรับ readiness check
อ่านจาก env var `KLIN_TCP_PROBE_TIMEOUT_MS` (default: 250ms)
ใช้ทั้งใน `is_llama_server_ready()` และ poll interval ของ `wait_for_llama_server_ready()`

```rust
fn tcp_probe_timeout() -> Duration {
    match std::env::var("KLIN_TCP_PROBE_TIMEOUT_MS") {
        Ok(val) => match val.parse::<u64>() {
            Ok(ms) => Duration::from_millis(ms),
            Err(_) => {
                eprintln!("[llama-server] KLIN_TCP_PROBE_TIMEOUT_MS={:?} is not valid, using 250ms", val);
                Duration::from_millis(250)
            }
        },
        Err(_) => Duration::from_millis(250),
    }
}
```

---

## การใช้งานฝั่ง Frontend

### `withLlama` — wrapper สำหรับ AI request ทุกตัว

```typescript
// src/hooks/useLlama.ts

export async function withLlama<T>(fn: () => Promise<T>): Promise<T> {
  // 1. ensure server กำลังรันอยู่ (spawn ถ้าจำเป็น)
  await tauriClient.ensureLlamaServer();
  try {
    return await fn();
  } finally {
    // 2. refresh idle timer หลัง request เสร็จ
    tauriClient.touchLlamaServer().catch(() => undefined);
  }
}
```

### `createLlamaStreamGuard` — refresh idle timer ระหว่าง stream

สำหรับ SSE streaming ที่ใช้เวลานาน `withLlama` อย่างเดียวไม่พอ
เพราะ `finally` จะทำงานหลัง stream จบเท่านั้น
ใช้ `createLlamaStreamGuard` เพื่อ touch ทุก chunk ที่อ่าน

```typescript
// src/hooks/useLlama.ts

export function createLlamaStreamGuard(): { onChunkRead: () => void } {
  return {
    onChunkRead: () => {
      tauriClient.touchLlamaServer().catch(() => undefined);
    },
  };
}
```

### ตัวอย่างการใช้ในบริการต่าง ๆ

```typescript
// organize (non-streaming) — withLlama เพียงพอ
const result = await withLlama(() =>
  fetch("http://127.0.0.1:8000/api/organize", {
    method: "POST",
    body: JSON.stringify(payload),
  })
);

// summary streaming (SSE) — ใช้ทั้ง withLlama + createLlamaStreamGuard
const result = await withLlama(async () => {
  const response = await fetch("http://127.0.0.1:8000/api/summary/stream", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const reader = response.body!.getReader();
  const { onChunkRead } = createLlamaStreamGuard();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunkRead(); // ← refresh idle timer ทุก chunk
    // ... process chunk ...
  }
  return result;
});
```

### Tauri commands ที่เปิดให้ frontend เรียก

| Command | ฟังก์ชัน Rust | ใช้เมื่อ |
|---|---|---|
| `ensure_llama_server` | `ensure_llama_server_running` | ก่อน AI request ทุกครั้ง |
| `touch_llama_server` | `touch_llama_last_used` | หลัง request เสร็จ / ระหว่าง stream chunk |
| `stop_llama_server` | `stop_llama_server_process` | user กด stop ใน settings |

---

## ปัญหาที่แก้ไป

### 1. Premature Idle Kill ระหว่าง Streaming

**อาการ**: Server ถูก kill ระหว่าง SSE streaming แม้ว่า process ยังรันอยู่

**สาเหตุ**: `last_used` ถูกอัปเดตเพียงครั้งเดียวตอนเริ่ม request

```
t=0s    withLlama() เรียก ensureLlamaServer → last_used = t+0
t=0s    SSE stream เริ่ม
...
t=300s  idle timer: elapsed > 300s → KILL ← ❌ server ตายระหว่าง stream
```

**วิธีแก้**: `withLlama` เรียก `touchLlamaServer` ใน `finally` block +
`createLlamaStreamGuard` เรียก `touchLlamaServer` ทุก chunk ระหว่าง stream

```
t=0s    ensureLlamaServer → last_used = t+0
t=0s    SSE stream เริ่ม
t=30s   onChunkRead() → last_used = t+30
...
t=300s  onChunkRead() → last_used = t+300   ← ✅ idle timer เห็น elapsed = 0s
t=350s  stream จบ → finally: touchLlamaServer → last_used = t+350
```

---

### 2. Stop/Ensure Race Condition

**อาการ**: เรียก `stop_llama_server` แต่ server ถูก respawn ทันทีโดย concurrent caller
ที่กำลังรอบน Condvar

**สาเหตุ**: `stop` set phase → `Idle` → notify condvar → concurrent caller เห็น `Idle`
→ spawn ใหม่ทันที

**วิธีแก้**: เพิ่ม `stop_requested: Arc<AtomicBool>` —
- `stop_llama_server_process` set เป็น `true`
- `ensure_llama_server_running` ตรวจ flag ก่อน spawn → return `Err("server stopped by user")`
- caller ใหม่ clear flag ที่จุดเริ่มต้น → สามารถ spawn ได้ตามปกติ
- idle timer ไม่ set flag → server สามารถ restart หลัง idle kill ได้

---

### 3. Idle Timer Graceful Shutdown

**อาการ**: ปิด app แล้ว idle-timeout thread ยังรันอยู่อีก 30 วินาที

**สาเหตุ**: ใช้ `std::thread::sleep(30s)` ที่ไม่สามารถ interrupt ได้

**วิธีแก้**: เปลี่ยนเป็น `parking_lot::Condvar::wait_for` ที่สามารถ
ปลุกได้ทันทีผ่าน `shutdown_condvar` เมื่อ app exit handler ทำงาน

---

### 4. Configurable TCP Probe Timeout

**อาการ**: บน hardware ช้า TCP probe 250ms ไม่พอ ทำให้เกิด false `Crashed` transitions

**วิธีแก้**: อ่านจาก env var `KLIN_TCP_PROBE_TIMEOUT_MS` (default: 250ms)
log warning ถ้าค่าไม่ถูกต้อง

---

## Environment Variables

| Variable | Default | คำอธิบาย |
|---|---|---|
| `KLIN_MODEL_PATH` | (required) | path ของ model `.gguf` |
| `KLIN_LLAMA_PORT` | `8080` | port ที่ llama-server ฟัง |
| `KLIN_N_GPU_LAYERS` | `-1` | จำนวน layer บน GPU (-1 = ทั้งหมด) |
| `KLIN_CTX_SIZE` | `4096` | context window size |
| `KLIN_MMPROJ_PATH` | (optional) | path ของ multimodal projector |
| `KLIN_LLAMA_IDLE_TIMEOUT` | `300` | วินาทีก่อน auto-stop เมื่อ idle |
| `KLIN_TCP_PROBE_TIMEOUT_MS` | `250` | TCP probe timeout (ms) สำหรับ readiness check |
