import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/not-use-ui/button";
import { useApiLogStore, type ApiLogEntry } from "@/stores/use-api-log-store";
import { cn } from "@/lib/utils";

function LogEntryRow({ log }: { log: ApiLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const isError = log.status >= 400 || log.error;

  return (
    <div className="flex flex-col border-b border-border/50 bg-card last:border-0">
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50",
          isError && "bg-destructive/5"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex w-6 items-center justify-center text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          <div
            className={cn(
              "flex w-14 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              {
                "bg-blue-500/15 text-blue-600 dark:text-blue-400": log.method === "GET",
                "bg-green-500/15 text-green-600 dark:text-green-400": log.method === "POST",
                "bg-orange-500/15 text-orange-600 dark:text-orange-400": log.method === "PUT" || log.method === "PATCH",
                "bg-red-500/15 text-red-600 dark:text-red-400": log.method === "DELETE",
                "bg-muted text-foreground": !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(log.method)
              }
            )}
          >
            {log.method}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                log.status >= 200 && log.status < 300 && "bg-green-500/15 text-green-600 dark:text-green-400",
                log.status >= 400 && "bg-destructive/15 text-destructive",
                log.status > 0 && log.status < 200 && "bg-muted text-muted-foreground",
                log.status === 0 && "bg-muted text-muted-foreground"
              )}
            >
              {log.status > 0 ? log.status : "ERR"}
            </span>
            <span className="truncate font-mono text-sm text-foreground max-w-[400px]" title={log.url}>
              {log.url.replace(/http(s)?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/, "") || log.url}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" />
            {log.latencyMs}ms
          </div>
          <div className="w-20 text-right">
            {new Date(log.timestamp).toLocaleTimeString(undefined, {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit"
            })}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/30 bg-muted/10 p-4 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Request</p>
              <div className="mb-2 flex flex-col gap-1 text-xs">
                <div><span className="font-semibold text-muted-foreground">URL:</span> <span className="font-mono text-foreground break-all">{log.url}</span></div>
                <div><span className="font-semibold text-muted-foreground">Time:</span> <span className="text-foreground">{new Date(log.timestamp).toISOString()}</span></div>
              </div>
              {log.requestBody ? (
                <pre className="max-h-[300px] overflow-auto rounded border border-border bg-background p-2 text-xs font-mono">
                  {formatJson(log.requestBody as string)}
                </pre>
              ) : (
                <div className="rounded border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
                  No request body
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Response</p>
              {log.error && (
                <div className="mb-2 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                  <span className="font-bold">Error:</span> {log.error}
                </div>
              )}
              {log.responseBody ? (
                <pre className="max-h-[300px] overflow-auto rounded border border-border bg-background p-2 text-xs font-mono">
                  {formatJson(log.responseBody as string)}
                </pre>
              ) : (
                <div className="rounded border border-dashed border-border p-2 text-center text-xs text-muted-foreground">
                  No response body
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatJson(val: string) {
  try {
    return JSON.stringify(JSON.parse(val), null, 2);
  } catch {
    return val;
  }
}

export function ApiLogsPage() {
  const navigate = useNavigate();
  const logs = useApiLogStore((state) => state.logs);
  const clearLogs = useApiLogStore((state) => state.clearLogs);

  if (!import.meta.env.DEV) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        API Logs are only available in Development Mode.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col space-y-7 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Developer</p>
            <h2 className="font-syne text-2xl font-black uppercase tracking-tight">Frontend API Logs</h2>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => clearLogs()} className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          Clear Logs
        </Button>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/40 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            <div className="flex items-center gap-10">
              <span className="w-14 pl-12">Method</span>
              <span>Status & URL</span>
            </div>
            <div className="flex items-center gap-8">
              <span>Latency</span>
              <span>Time</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center space-y-3 p-8 text-center text-muted-foreground">
                <div className="rounded-full bg-muted p-3">
                  <Clock className="h-6 w-6 opacity-40" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">No API logs yet</p>
                  <p className="text-xs">Requests made by the frontend will appear here.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {logs.map((log) => (
                  <LogEntryRow key={log.id} log={log} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
