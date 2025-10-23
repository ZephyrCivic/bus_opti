/**
 * src/config/appStep.ts
 * Step 切り替え用の環境変数を一元管理する。Step1 では警告/KPI を非表示にする。
 */

const rawStep =
  (import.meta.env.APP_STEP ?? import.meta.env.VITE_APP_STEP ?? '1') as string | boolean | undefined;

const parsedStep = (() => {
  if (typeof rawStep === 'boolean') {
    return rawStep ? 1 : 0;
  }
  const numeric = Number.parseInt(String(rawStep), 10);
  return Number.isFinite(numeric) ? numeric : 1;
})();

export const appStep = parsedStep > 0 ? parsedStep : 1;
export const isStepOne = appStep === 1;
export const isStepTwoOrHigher = appStep >= 2;

