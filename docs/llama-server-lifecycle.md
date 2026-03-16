# llama-server Lifecycle Management

## ภาพรวม

`llama-server` เป็น sidecar process ที่รัน llama.cpp HTTP inference server ภายใน Tauri app
ตั้งแต่การ refactor เป็น multi-slot สามารถรัน **หลาย instance พร้อมกัน** ได้ แต่ละ slot
มี lifecycle, port, model, และ idle timer ของตัวเองอย่างอิสระ

การจัดการ lifecycle ทั้งหมดอยู่ใน [`src-tauri/src/sidecars/llama_server.rs`](../src-tauri/src/sidecars/llama_server.rs)

---

## Model Slots

```rust
// src-tauri/src/sidecars/llama_server.rs

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum ModelSlot {
    Chat,   // Qwen2.5-VL vision+chat model — port 8080
    Embed,  // Text embedding model — port 8081
}
```

| Slot | ใช้สำหรับ | Port default |
|---|---|---|
| `Chat` | chat, vision, summarize, organize | 8080 |
| `Embed` | text embedding | 8081 |

แต่ละ slot รัน `llama-server` process แยกกันโดยสมบูรณ์ — crash ของ slot หนึ่งไม่กระทบอีก slot

---

## State Machine — `LaunchPhase`

State machine นี้ใช้ร่วมกันทุก slot แต่แต่ละ slot มี instance แยก

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

---

## LlamaSlotState — state ต่อ slot

state ทั้งหมดที่เกี่ยวกับ lifecycle ถูก extract ออกจาก `AppState` เป็น struct แยก
แต่ละ slot มี instance ของ struct นี้เป็นของตัวเอง

```rust
pub struct LlamaSlotState {
    pub slot:             ModelSlot,
    pub child:            Arc<Mutex<Option<CommandChild>>>,
    pub last_used:        Arc<Mutex<Option<Instant>>>,
    pub phase:            Arc<Mutex<LaunchPhase>>,
    pub phase_condvar:    Arc<Condvar>,
    pub stop_requested:   Arc<AtomicBool>,
    pub idle_shutdown:    Arc<Mutex<bool>>,
    pub shutdown_condvar: Arc<Condvar>,
}
```

| Field | หน้าที่ |
|---|---|
| `child` | handle ของ process ที่รันอยู่ |
| `last_used` | timestamp ล่าสุด ใช้โดย idle timer |
| `phase` | state ปัจจุบัน |
| `phase_condvar` | wake up callers ที่รออยู่เมื่อ phase เปลี่ยน |
| `stop_requested` | ป้องกัน respawn หลัง explicit stop (idle timer ไม่ set) |
| `idle_shutdown` | สัญญาณ shutdown สำหรับ idle-timeout thread ของ slot นี้ |
| `shutdown_condvar` | ปลุก idle-timeout thread ให้ออกทันทีเมื่อ app ปิด |

---

## AppState

```rust
pub struct AppState {
    pub slots: HashMap<ModelSlot, LlamaSlotState>,
    pub worker_child: Arc<Mutex<Option<CommandChild>>>,
    // services...
}

impl AppState {
    pub fn slot(&self, s: ModelSlot) -> &LlamaSlotState {
        self.slots.get(&s).expect("unknown model slot")
    }
}
```

Slots ทั้งหมดถูก initialize ตอน app startup พร้อม idle timer แยกกัน:

```rust
let mut slots = HashMap::new();
for s in [ModelSlot::Chat, ModelSlot::Embed] {
    let slot_state = LlamaSlotState::new(s);
    sidecars::spawn_idle_timeout_task_for_slot(&slot_state);
    slots.insert(s, slot_state);
}
```

---

## ฟังก์ชันหลัก

### 1. `ensure_slot_running` — เริ่ม / ยืนยัน server ของ slot

entry point หลักสำหรับทุก AI request รับ `&LlamaSlotState` แทน `&AppState`

```rust
pub fn ensure_slot_running<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    slot: &LlamaSlotState,
) -> Result<(), String>
```

**พฤติกรรมตาม phase** (เหมือนเดิม แต่ทำงานต่อ slot):

| Phase | การทำงาน |
|---|---|
| `Running` | TCP probe → อัปเดต `last_used` → return OK |
| `Starting` | รอบน Condvar จนกว่า phase จะเปลี่ยน |
| `Idle` / `Crashed` | ตรวจ `stop_requested` → claim `Starting` → spawn → poll TCP → `Running` |

ที่จุดเริ่มต้นของฟังก์ชัน จะ clear `stop_requested` เพื่อให้ caller ใหม่สามารถ spawn ได้

---

### 2. `spawn_slot` — spawn process ตาม slot config

อ่าน env vars ตาม slot แล้ว spawn พร้อม async termination monitor

**Chat slot:**
```
llama-server -m {KLIN_CHAT_MODEL_PATH} -ngl {KLIN_N_GPU_LAYERS} -c {KLIN_CTX_SIZE}
             --host 127.0.0.1 --port {KLIN_CHAT_PORT} --no-webui
             [--mmproj {KLIN_MMPROJ_PATH}]   ← ถ้า set
```

**Embed slot:**
```
llama-server -m {KLIN_EMBED_MODEL_PATH} -ngl {KLIN_EMBED_N_GPU_LAYERS}
             --host 127.0.0.1 --port {KLIN_EMBED_PORT} --no-webui
             --embedding --pooling mean
```

**async termination monitor** (เหมือนเดิม ทุก slot):
- ดัก `CommandEvent::Terminated`
- ถ้า phase ไม่ใช่ `Idle` → set `Crashed` → notify condvar
- ถ้า phase เป็น `Idle` → ไม่ทำอะไร (แปลว่า stop ตั้งใจ)

---

### 3. `touch_slot_last_used` — refresh idle timer

```rust
pub fn touch_slot_last_used(slot: &LlamaSlotState) {
    let phase = slot.phase.lock();
    if matches!(*phase, LaunchPhase::Running) {
        *slot.last_used.lock() = Some(Instant::now());
    }
}
```

---

### 4. `stop_slot` — หยุด server ของ slot

```rust
pub fn stop_slot(slot: &LlamaSlotState) {
    slot.stop_requested.store(true, Ordering::SeqCst); // ← ก่อน kill เสมอ
    super::kill_sidecar(&format!("llama-server[{}]", slot.slot.label()), &slot.child);
    *slot.phase.lock() = LaunchPhase::Idle;
    slot.phase_condvar.notify_all();
    *slot.last_used.lock() = None;
}
```

> `stop_requested` ต้อง set ก่อน kill เสมอ เพื่อป้องกัน concurrent Condvar waiters
> จาก respawn ทันทีหลัง stop

---

### 5. `spawn_idle_timeout_task_for_slot` — auto-stop เมื่อ idle

Background thread แยกต่อ slot poll ทุก 30 วินาที
หาก `last_used` เกิน timeout (default 300s) จะ set `Idle` → kill child

```rust
pub fn spawn_idle_timeout_task_for_slot(slot: &LlamaSlotState)
```

**สำคัญ**: idle timer **ไม่** set `stop_requested` — ดังนั้น request ใหม่หลัง idle kill
จะ spawn server ขึ้นมาใหม่ได้ตามปกติ

---

## App Exit Handler

```rust
.run(|app, event| {
    if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
        let state = app.state::<AppState>();
        // ส่ง shutdown signal ทุก slot
        for slot_state in state.slots.values() {
            *slot_state.idle_shutdown.lock() = true;
            slot_state.shutdown_condvar.notify_all();
        }
        sidecars::cleanup_all(app); // kill ทุก child process
    }
});
```

---

## Tauri Commands

Commands ทั้งหมดรับ `slot: String` parameter เพิ่มเติม

```rust
#[tauri::command]
pub fn ensure_llama_server<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    state: State<AppState>,
    slot: String,             // "chat" | "embed"
) -> Result<(), String> {
    let model_slot = crate::sidecars::ModelSlot::from_str(&slot)?;
    crate::sidecars::ensure_slot_running(&app, state.slot(model_slot))
}
```

| Command | Rust function | ใช้เมื่อ |
|---|---|---|
| `ensure_llama_server` | `ensure_slot_running` | ก่อน AI request ทุกครั้ง |
| `touch_llama_server` | `touch_slot_last_used` | หลัง request เสร็จ / ระหว่าง stream chunk |
| `stop_llama_server` | `stop_slot` | user กด stop |

---

## การใช้งานฝั่ง Frontend

### `withLlama` — wrapper สำหรับ AI request

รับ `slots: ModelSlot[]` เป็น argument แรก รองรับ ensure หลาย slot พร้อมกัน

```typescript
// src/hooks/useLlama.ts

export async function withLlama<T>(
  slots: ModelSlot[],
  fn: () => Promise<T>,
): Promise<T> {
  await Promise.all(slots.map((s) => tauriClient.ensureLlamaServer(s)));
  try {
    return await fn();
  } finally {
    slots.forEach((s) => tauriClient.touchLlamaServer(s).catch(() => undefined));
  }
}
```

### `createLlamaStreamGuard` — refresh idle timer ระหว่าง stream

รับ `slot: ModelSlot` เพื่อระบุว่า touch slot ไหน

```typescript
export function createLlamaStreamGuard(slot: ModelSlot): { onChunkRead: () => void } {
  return {
    onChunkRead: () => {
      tauriClient.touchLlamaServer(slot).catch(() => undefined);
    },
  };
}
```

### `ModelSlot` type

```typescript
// src/types/ipc.ts
export type ModelSlot = 'chat' | 'embed';
```

### ตัวอย่างการใช้งาน

```typescript
// Chat request (non-streaming)
const result = await withLlama(['chat'], () =>
  fetch("http://127.0.0.1:8000/api/organize", { method: "POST", body: ... })
);

// Chat request (SSE streaming)
const result = await withLlama(['chat'], async () => {
  const response = await fetch("http://127.0.0.1:8000/api/summary/stream", { ... });
  const reader = response.body!.getReader();
  const { onChunkRead } = createLlamaStreamGuard('chat');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunkRead(); // ← refresh idle timer ทุก chunk
    // ... process chunk ...
  }
  return result;
});

// ต้องการทั้ง chat + embed พร้อมกัน
const result = await withLlama(['chat', 'embed'], () => someRequest());
```

### `TauriClient` interface

```typescript
interface TauriClient {
  ensureLlamaServer(slot: ModelSlot): Promise<void>;
  touchLlamaServer(slot: ModelSlot): Promise<void>;
  stopLlamaServer(slot: ModelSlot): Promise<void>;
  // ...
}
```

---

## Environment Variables

### Chat Slot

| Variable | Default | คำอธิบาย |
|---|---|---|
| `KLIN_CHAT_MODEL_PATH` | (required) | path ของ chat/vision model `.gguf` (fallback: `KLIN_MODEL_PATH`) |
| `KLIN_CHAT_PORT` | `8080` | port ที่ chat llama-server ฟัง (fallback: `KLIN_LLAMA_PORT`) |
| `KLIN_N_GPU_LAYERS` | `-1` | จำนวน layer บน GPU (-1 = ทั้งหมด) |
| `KLIN_CTX_SIZE` | `4096` | context window size |
| `KLIN_MMPROJ_PATH` | (optional) | path ของ multimodal projector สำหรับ vision |

### Embed Slot

| Variable | Default | คำอธิบาย |
|---|---|---|
| `KLIN_EMBED_MODEL_PATH` | (required) | path ของ embedding model `.gguf` |
| `KLIN_EMBED_PORT` | `8081` | port ที่ embed llama-server ฟัง |
| `KLIN_EMBED_N_GPU_LAYERS` | `0` | GPU layers สำหรับ embed (default CPU เพื่อประหยัด VRAM) |

### Shared

| Variable | Default | คำอธิบาย |
|---|---|---|
| `KLIN_LLAMA_IDLE_TIMEOUT` | `300` | วินาทีก่อน auto-stop เมื่อ idle (ใช้ร่วมกันทุก slot) |
| `KLIN_TCP_PROBE_TIMEOUT_MS` | `250` | TCP probe timeout (ms) สำหรับ readiness check |

---

## Invariants

| # | Invariant | เหตุผล |
|---|---|---|
| 1 | `stop_requested = true` **ก่อน** kill เสมอ | ป้องกัน Condvar waiters respawn ทันทีหลัง stop |
| 2 | idle timer **ไม่** set `stop_requested` | server restart ได้หลัง idle kill เมื่อมี request ใหม่ |
| 3 | termination monitor ไม่ overwrite `Idle` | ป้องกัน false `Crashed` หลัง intentional stop |
| 4 | `ensure_slot_running` clear `stop_requested` ที่ entry | caller ใหม่ spawn ได้เสมอ |
| 5 | แต่ละ slot เป็นอิสระจากกัน | Chat crash ไม่กระทบ Embed และกลับกัน |
| 6 | TCP probe timeout ใช้ร่วมกัน | configure ครั้งเดียวผ่าน `KLIN_TCP_PROBE_TIMEOUT_MS` |
