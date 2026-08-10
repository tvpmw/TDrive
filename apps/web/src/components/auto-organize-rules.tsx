"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Plus, Trash2, Loader2, Power, FolderInput, Tag as TagIcon, Webhook } from "lucide-react";

interface AutomationRule {
  id: string;
  name: string;
  triggerEvent: string;
  actionType: string;
  targetUrl: string | null;
  config: {
    conditions?: { field?: string; op?: string; value?: string }[];
    targetFolderName?: string;
    tags?: string;
  } | null;
  isActive: number;
}

const CONDITION_FIELDS = [
  { value: "extension", label: "Ekstensi file" },
  { value: "name", label: "Nama file" },
  { value: "mimeType", label: "MIME type" },
  { value: "size", label: "Ukuran (bytes)" },
];

const CONDITION_OPS = [
  { value: "eq", label: "=" },
  { value: "contains", label: "mengandung" },
  { value: "startsWith", label: "diawali" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
];

export function AutoOrganizeRules() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [actionType, setActionType] = useState<"move-to-folder" | "tag" | "webhook">("move-to-folder");
  const [targetFolderName, setTargetFolderName] = useState("Photos");
  const [tags, setTags] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [condField, setCondField] = useState("extension");
  const [condOp, setCondOp] = useState("eq");
  const [condValue, setCondValue] = useState("jpg");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const res = await apiClient.get("/automation");
      return (res.data?.data ?? []) as AutomationRule[];
    },
  });

  const createRule = useMutation({
    mutationFn: async () => {
      const config: Record<string, any> = {};
      if (actionType === "move-to-folder") config.targetFolderName = targetFolderName || "Photos";
      if (actionType === "tag") config.tags = tags;
      if (condField && condValue) {
        config.conditions = [{ field: condField, op: condOp, value: condValue }];
      }
      await apiClient.post("/automation", {
        name,
        trigger_event: "file.uploaded",
        action_type: actionType,
        target_url: actionType === "webhook" ? targetUrl : null,
        config,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      setShowForm(false);
      setName("");
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: number }) => {
      await apiClient.patch(`/automation/${id}`, { is_active: isActive ? 0 : 1 });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/automation/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const actionMeta: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    "move-to-folder": { icon: <FolderInput className="h-3.5 w-3.5" />, label: "Pindah ke folder", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
    tag: { icon: <TagIcon className="h-3.5 w-3.5" />, label: "Set tags", color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
    webhook: { icon: <Webhook className="h-3.5 w-3.5" />, label: "Webhook", color: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Rules dieksekusi otomatis saat file baru diupload ke drive Anda.</p>
        <Button size="sm" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Tutup" : <><Plus className="h-3.5 w-3.5 mr-1" /> Rule Baru</>}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nama Rule</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder='cth: "Foto dari bot → folder Photos"' className="h-8 text-xs" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Aksi</Label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
                className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                <option value="move-to-folder">Pindah ke folder</option>
                <option value="tag">Set tags</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
            {actionType === "move-to-folder" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Folder tujuan</Label>
                <Input value={targetFolderName} onChange={(e) => setTargetFolderName(e.target.value)} placeholder="Photos" className="h-8 text-xs" />
              </div>
            )}
            {actionType === "tag" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tags (CSV)</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="foto,liburan" className="h-8 text-xs" />
              </div>
            )}
            {actionType === "webhook" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">URL webhook</Label>
                <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://hooks.example.com/..." className="h-8 text-xs" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Kondisi</Label>
              <select value={condField} onChange={(e) => setCondField(e.target.value)} className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs">
                {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operator</Label>
              <select value={condOp} onChange={(e) => setCondOp(e.target.value)} className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs">
                {CONDITION_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nilai</Label>
              <Input value={condValue} onChange={(e) => setCondValue(e.target.value)} placeholder="jpg / foto / 1000" className="h-8 text-xs" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" className="h-8 text-xs" onClick={() => createRule.mutate()} disabled={!name.trim() || createRule.isPending}>
              {createRule.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
              Simpan Rule
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <div className="text-center py-6 text-xs text-muted-foreground">Memuat rules…</div>}
        {!isLoading && rules.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            <Zap className="h-6 w-6 mx-auto mb-2 opacity-40" />
            Belum ada rule auto-organize. Buat rule pertama untuk memindahkan file otomatis.
          </div>
        )}
        {rules.map((rule) => {
          const meta = actionMeta[rule.actionType] ?? actionMeta["webhook"];
          return (
            <div key={rule.id} className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors ${rule.isActive === 1 ? "border-border/60 bg-card/40" : "border-border/30 bg-card/20 opacity-60"}`}>
              <div className={`p-1.5 rounded-lg border shrink-0 ${meta.color}`}>{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{rule.name}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-600 text-slate-400">trigger: file.uploaded</Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-600 text-slate-400">{meta.label}</Badge>
                  {rule.config?.targetFolderName && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-500/40 text-emerald-400">→ {rule.config.targetFolderName}</Badge>}
                  {rule.config?.tags && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-pink-500/40 text-pink-400">#{rule.config.tags}</Badge>}
                  {rule.config?.conditions?.map((c, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 border-sky-500/40 text-sky-400">
                      {c.field} {c.op} {c.value}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" title={rule.isActive === 1 ? "Nonaktifkan" : "Aktifkan"} onClick={() => toggleRule.mutate({ id: rule.id, isActive: rule.isActive })}>
                <Power className={`h-3.5 w-3.5 ${rule.isActive === 1 ? "text-emerald-400" : "text-muted-foreground"}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { if (confirm(`Hapus rule "${rule.name}"?`)) deleteRule.mutate(rule.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}