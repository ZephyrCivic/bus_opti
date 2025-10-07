"""
config.py

Purpose: Centralized defaults for Duty-related limits used by the TypeScript UI/tests.
Notes: Keep values aligned with src/services/duty/constants.ts (tests assert parity).

Defaults below reflect the Japanese bus drivers' 2024 labor standards guidance:
- Continuous driving at most 4 hours (240 minutes)
- Breaks total at least 30 minutes (can be split into >=10 minute chunks)
- Daily duty span (拘束時間) principle 13 hours (780 minutes)
These are defaults for alerts in the tool; operators may tighten/loosen via UI.
"""

DUTY_MAX_CONTINUOUS_MINUTES = 240
DUTY_MIN_BREAK_MINUTES = 30
DUTY_MAX_DAILY_MINUTES = 780
DUTY_UNDO_STACK_LIMIT = 50

