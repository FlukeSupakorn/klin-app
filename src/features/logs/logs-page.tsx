import { Fragment, useMemo, useState } from "react";
import { History, Search, Filter, ChevronDown, ChevronUp, FileText, MapPin, Clock, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLogStore } from "@/stores/use-log-store";
import { cn } from "@/lib/utils";

export function HistoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const logs = useLogStore((state) => state.logs);
  const filters = useLogStore((state) => state.filters);
  const pagination = useLogStore((state) => state.pagination);
  const setFilters = useLogStore((state) => state.setFilters);
  const setPage = useLogStore((state) => state.setPage);

  const filtered = useMemo(() => {
    return [...logs].reverse().filter((log) => {
      const bySearch =
        filters.search.length === 0 ||
        log.fileName.toLowerCase().includes(filters.search.toLowerCase()) ||
        log.originalPath.toLowerCase().includes(filters.search.toLowerCase());
      const byStatus = filters.status === "all" || log.status === filters.status;
      const byCategory = filters.category.length === 0 || log.chosenCategory === filters.category;
      return bySearch && byStatus && byCategory;
    });
  }, [logs, filters]);

  const rows = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return filtered.slice(start, start + pagination.pageSize);
  }, [filtered, pagination.page, pagination.pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-semibold tracking-tight">History</h2>
          <p className="text-muted-foreground">Monitor file and folder change history from AI-driven operations.</p>
        </div>
        <Card className="flex items-center gap-3 px-4 py-2 shadow-none">
          <History className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Actions</p>
            <p className="text-lg font-semibold">{logs.length}</p>
          </div>
        </Card>
      </div>

      <Card className="border-0 bg-muted/40 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-lg">Filter History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search file or path..." 
              value={filters.search} 
              onChange={(event) => setFilters({ search: event.target.value })} 
              className="pl-9 bg-background"
            />
          </div>
          <Input 
            placeholder="Status (completed/failed)" 
            value={filters.status === "all" ? "" : filters.status} 
            onChange={(event) => setFilters({ status: (event.target.value as never) || "all" })} 
            className="bg-background"
          />
          <Input 
            placeholder="Category..." 
            value={filters.category} 
            onChange={(event) => setFilters({ category: event.target.value })} 
            className="bg-background"
          />
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-0 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[40%]">File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>AI Classification</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No history records found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((log) => (
                <Fragment key={log.id}>
                  <TableRow className={cn("transition-colors", expandedId === log.id && "bg-muted/30")}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[300px]" title={log.fileName}>{log.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">
                        {log.itemType ?? "file"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          {log.chosenCategory}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                          {Math.round(log.score * 100)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={log.status === "completed" ? "default" : "destructive"}
                        className={cn("text-[10px] uppercase font-bold", log.status === "completed" ? "bg-green-500 hover:bg-green-600" : "")}
                      >
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="gap-1"
                      >
                        {expandedId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow className="bg-muted/10">
                      <TableCell colSpan={6} className="p-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                <MapPin className="h-3 w-3" /> Path Details
                              </p>
                              <div className="rounded-xl bg-background p-3 text-sm space-y-2 border border-border/50">
                                <p><span className="text-muted-foreground mr-2">From:</span> {log.originalPath}</p>
                                <p><span className="text-muted-foreground mr-2">To:</span> {log.movedTo || "---"}</p>
                              </div>
                            </div>
                            <div className="flex gap-6">
                              <div className="space-y-1">
                                <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                                  <Clock className="h-3 w-3" /> Processing Time
                                </p>
                                <p className="text-sm font-semibold">{log.processingTimeMs} ms</p>
                              </div>
                              {log.errorMessage && (
                                <div className="space-y-1">
                                  <p className="text-xs font-bold uppercase text-destructive flex items-center gap-2">
                                    Error
                                  </p>
                                  <p className="text-sm text-destructive">{log.errorMessage}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                              <BarChart3 className="h-3 w-3" /> AI Scoring Breakdown
                            </p>
                            <div className="rounded-xl bg-background p-4 border border-border/50 space-y-3">
                              {log.allScores.map((entry) => (
                                <div key={entry.name} className="space-y-1">
                                  <div className="flex justify-between text-xs font-medium">
                                    <span>{entry.name}</span>
                                    <span>{Math.round(entry.score * 100)}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        entry.name === log.chosenCategory ? "bg-primary" : "bg-muted-foreground/30"
                                      )}
                                      style={{ width: `${entry.score * 100}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold">{rows.length}</span> of <span className="font-semibold">{total}</span> history records
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={pagination.page <= 1}
              onClick={() => setPage(Math.max(1, pagination.page - 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs font-medium px-2">
              Page {pagination.page} / {totalPages}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={pagination.page >= totalPages}
              onClick={() => setPage(Math.min(totalPages, pagination.page + 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
