export const MADMAX_FLAG = '--madmax';
export const COPILOT_BYPASS_FLAG = '--allow-all-tools';
// Copilot CLI's full-bypass flag: equivalent to
// `--allow-all-tools --allow-all-paths --allow-all-urls`. OMCP's `--madmax`
// expands to this, since the historical Codex-era "bypass approvals AND
// sandbox" semantic matches --yolo (broad) rather than --allow-all-tools alone.
export const COPILOT_YOLO_FLAG = '--yolo';
export const CLAUDE_SKIP_PERMISSIONS_FLAG = '--dangerously-skip-permissions';
export const HIGH_REASONING_FLAG = '--high';
export const XHIGH_REASONING_FLAG = '--xhigh';
export const SPARK_FLAG = '--spark';
export const MADMAX_SPARK_FLAG = '--madmax-spark';
export const CONFIG_FLAG = '-c';
export const LONG_CONFIG_FLAG = '--config';
export const MODEL_FLAG = '--model';
