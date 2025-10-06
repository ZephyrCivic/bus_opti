"""
config.py
何: ランタイム設定値を単一箇所に集約する簡易コンテナ。
なぜ: TypeScript側・テスト側でDuty関連の閾値を共有する際に参照できるようにする。
"""

DUTY_MAX_CONTINUOUS_MINUTES = 240
DUTY_MIN_BREAK_MINUTES = 30
DUTY_MAX_DAILY_MINUTES = 540
DUTY_UNDO_STACK_LIMIT = 50
