"use client";

import { useState } from "react";

type SalaryRangeFilterProps = {
  minSalary: string;
  maxSalary: string;
  salaryCurrency: string;
};

const amountClass = "box-border min-h-10 w-full min-w-0 rounded-lg border border-line bg-white px-2 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/15";

export function SalaryRangeFilter({ minSalary, maxSalary, salaryCurrency }: SalaryRangeFilterProps) {
  const [minimum, setMinimum] = useState(minSalary);
  const [maximum, setMaximum] = useState(maxSalary);
  const invalidRange = minimum !== "" && maximum !== "" &&
    Number.isFinite(Number(minimum)) && Number.isFinite(Number(maximum)) &&
    Number(maximum) < Number(minimum);

  return (
    <div className="min-w-0 rounded-xl border border-line bg-white p-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Salary range</span>
        <label className="shrink-0">
          <span className="sr-only">Salary currency</span>
          <select name="salary_currency" defaultValue={salaryCurrency} className="rounded-lg border border-line bg-canvas px-2 py-1 text-xs font-semibold"><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select>
        </label>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Minimum
          <input name="min_salary" type="number" min="0" step="1000" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="800000" aria-invalid={invalidRange} aria-describedby={invalidRange ? "salary-range-error" : undefined} className={amountClass} />
        </label>
        <label className="grid min-w-0 gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
          Maximum
          <input name="max_salary" type="number" min={minimum || "0"} step="1000" value={maximum} onChange={(event) => setMaximum(event.target.value)} placeholder="1200000" aria-invalid={invalidRange} aria-describedby={invalidRange ? "salary-range-error" : undefined} className={amountClass} />
        </label>
      </div>
      {invalidRange && <p id="salary-range-error" role="alert" className="mt-2 text-xs font-semibold leading-5 text-red-700">Maximum salary must be at least the minimum salary.</p>}
      <p className="mt-2 text-xs leading-5 text-ink-muted">Enter annual salary amounts in the selected currency. Only jobs with disclosed salary ranges are compared.</p>
    </div>
  );
}
