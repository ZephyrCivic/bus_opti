#!/usr/bin/env python3
# Where: tools/ui-snapshots/extract_previews.py
# What: Playwright ベースの UI スナップショット撮影を簡易実行する CLI ツール
# Why: 再利用可能なラッパーを用意し、他プロジェクトでも既存テスト資産を最小手順で呼び出すため

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Playwright の UI スナップショットテストを実行／更新するヘルパー"
    )
    parser.add_argument(
        "--base-url",
        help="APP_BASE_URL を上書きする場合に指定（例: https://dev.example.com）",
    )
    parser.add_argument(
        "--config",
        default="playwright.config.ts",
        help="Playwright 設定ファイルのパス（既定: playwright.config.ts）",
    )
    parser.add_argument(
        "--tests",
        default="tests/playwright",
        help="実行対象のテストディレクトリまたはファイル（既定: tests/playwright）",
    )
    parser.add_argument(
        "--grep",
        help="Playwright の --grep オプションを透過させて特定テストのみ実行する",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        help="SNAP_DIFF_THRESHOLD（%）を一時的に上書きする。例: --threshold 0.8",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="ヘッドフルモードで起動（デバッグ確認向け、既定はヘッドレス）",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="スナップショットベースラインを更新（Playwright の --update-snapshots を付与）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際に Playwright を起動せず、組み立てたコマンドだけを表示する",
    )
    return parser.parse_args()


def ensure_prerequisites(config_path: Path, tests_path: Path) -> None:
    if shutil.which("pnpm") is None:
        raise RuntimeError("pnpm コマンドが見つかりません。パッケージマネージャをセットアップしてください。")

    if not config_path.exists():
        raise FileNotFoundError(f"Playwright 設定が見つかりません: {config_path}")

    if not tests_path.exists():
        raise FileNotFoundError(f"テストディレクトリ/ファイルが見つかりません: {tests_path}")


def build_command(args: argparse.Namespace) -> list[str]:
    command = ["pnpm", "exec", "playwright", "test", "--config", args.config]
    if args.headed:
        command.append("--headed")
    if args.grep:
        command.extend(["--grep", args.grep])
    command.append(args.tests)
    if args.update:
        command.append("--update-snapshots=all")
    return command


def build_env(args: argparse.Namespace) -> dict[str, str]:
    env = os.environ.copy()
    if args.base_url:
        env["APP_BASE_URL"] = args.base_url
    if args.threshold is not None:
        env["SNAP_DIFF_THRESHOLD"] = str(args.threshold)
    return env


def main() -> int:
    args = parse_args()
    try:
        config_path = Path(args.config)
        tests_path = Path(args.tests)
        ensure_prerequisites(config_path, tests_path)
        command = build_command(args)
        env = build_env(args)
    except Exception as error:
        print(f"[extract_previews] セットアップエラー: {error}", file=sys.stderr)
        return 2

    print("[extract_previews] 実行コマンド:", " ".join(command))
    if args.dry_run:
        print("[extract_previews] dry-run のため実行をスキップしました。")
        return 0

    try:
        subprocess.run(command, env=env, check=True)
        return 0
    except subprocess.CalledProcessError as error:
        print(f"[extract_previews] Playwright 実行に失敗しました (exit={error.returncode})", file=sys.stderr)
        return error.returncode


if __name__ == "__main__":
    sys.exit(main())
