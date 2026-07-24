/**
 * TDrive Storage Policy Engine & Rules Evaluator DSL
 */

export interface StorageRule {
  id: string;
  conditionField: "size" | "mimeType" | "ageDays" | "floodWaitSec" | "channelCapacityPct";
  operator: ">" | "<" | "equals" | "startsWith";
  value: string | number;
  action: "set_chunk_size" | "set_account" | "enable_replica" | "rotate_channel" | "archive";
  actionTarget: string | number;
}

export interface RuleEvaluationContext {
  fileSize: number;
  mimeType?: string;
  ageDays?: number;
  floodWaitSec?: number;
  channelCapacityPct?: number;
}

export class PolicyEngine {
  private rules: StorageRule[] = [
    { id: "r1", conditionField: "size", operator: ">", value: 4000000000, action: "set_chunk_size", actionTarget: 16777216 }, // >4GB => 16MB chunk
    { id: "r2", conditionField: "channelCapacityPct", operator: ">", value: 90, action: "rotate_channel", actionTarget: "new_channel" },
    { id: "r3", conditionField: "ageDays", operator: ">", value: 180, action: "archive", actionTarget: "cold_storage_channel" },
    { id: "r4", conditionField: "mimeType", operator: "startsWith", value: "video/", action: "enable_replica", actionTarget: "true" },
  ];

  public evaluateRules(ctx: RuleEvaluationContext) {
    const matchedActions: Array<{ action: string; target: any }> = [];

    for (const rule of this.rules) {
      let isMatch = false;
      const ctxValue = ctx[rule.conditionField as keyof RuleEvaluationContext];

      if (ctxValue !== undefined) {
        if (rule.operator === ">" && typeof ctxValue === "number" && typeof rule.value === "number") {
          isMatch = ctxValue > rule.value;
        } else if (rule.operator === "<" && typeof ctxValue === "number" && typeof rule.value === "number") {
          isMatch = ctxValue < rule.value;
        } else if (rule.operator === "startsWith" && typeof ctxValue === "string" && typeof rule.value === "string") {
          isMatch = ctxValue.startsWith(rule.value);
        } else if (rule.operator === "equals") {
          isMatch = String(ctxValue) === String(rule.value);
        }
      }

      if (isMatch) {
        matchedActions.push({ action: rule.action, target: rule.actionTarget });
      }
    }

    return matchedActions;
  }
}

export const policyEngine = new PolicyEngine();
