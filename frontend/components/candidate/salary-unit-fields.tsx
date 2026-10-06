"use client";
import { useId, useState } from "react";
import type { FieldErrors } from "@/lib/profile-validation";
export function SalaryUnitFields({
  kind,
  annualAmount,
  initialUnit,
  errors,
}: {
  kind: "current" | "expected";
  annualAmount?: number;
  initialUnit?: string;
  errors: FieldErrors;
}) {
  const [unit, setUnit] = useState(
    initialUnit === "Monthly" ? "Monthly" : "Annual",
  );
  const [amount, setAmount] = useState(
    annualAmount == null
      ? ""
      : String(initialUnit === "Monthly" ? annualAmount / 12 : annualAmount),
  );
  const amountKey = kind + "_salary_amount",
    unitKey = kind + "_salary_unit";
  const id = useId();
  return (
    <div className="grid gap-3">
      <label className="profile-v2-field">
        {kind === "current" ? "Current salary" : "Expected salary"}
        <input
          className="profile-v2-input"
          name={amountKey}
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={!!errors[amountKey]}
          aria-describedby={
            errors[amountKey] ? amountKey + "-error" : undefined
          }
        />
      </label>
      {errors[amountKey] && (
        <p id={amountKey + "-error"} className="profile-v2-error">
          {errors[amountKey]}
        </p>
      )}
      <label className="profile-v2-field" htmlFor={id}>
        <span id={id + "-label"}>
          {kind === "current" ? "Current salary unit" : "Expected salary unit"}
        </span>
        <select
          id={id}
          aria-labelledby={id + "-label"}
          className="profile-v2-input"
          name={unitKey}
          value={unit}
          onChange={(event) => {
            const next = event.target.value;
            if (amount !== "" && Number.isFinite(Number(amount))) {
              const annual =
                Math.round(
                  Number(amount) * (unit === "Monthly" ? 12 : 1) * 100,
                ) / 100;
              setAmount(String(next === "Monthly" ? annual / 12 : annual));
            }
            setUnit(next);
          }}
        >
          <option>Annual</option>
          <option>Monthly</option>
        </select>
      </label>
      <p className="profile-v2-hint">
        The equivalent annual amount is retained for consistent salary
        preferences.
      </p>
    </div>
  );
}
