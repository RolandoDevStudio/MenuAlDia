"use client";

import { MX_STATES, citiesForState, normalizeLegacyState } from "@/lib/mx-locations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-11 w-full rounded-lg border border-black/10 bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand";

type Props = {
  state: string;
  city: string;
  onStateChange: (code: string) => void;
  onCityChange: (city: string) => void;
  stateError?: string;
  cityError?: string;
  /** When true, render hidden inputs for FormData submit */
  formNames?: boolean;
  idPrefix?: string;
};

export function MxLocationFields({
  state,
  city,
  onStateChange,
  onCityChange,
  stateError,
  cityError,
  formNames = false,
  idPrefix = "",
}: Props) {
  const stateId = `${idPrefix}state`;
  const cityId = `${idPrefix}city`;
  const listId = `${idPrefix}city-suggestions`;
  const code = normalizeLegacyState(state) || state;
  const suggestions = citiesForState(code);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={stateId}>Estado</Label>
        <select
          id={stateId}
          name={formNames ? "state" : undefined}
          className={selectClass}
          value={code}
          onChange={(e) => onStateChange(e.target.value)}
          aria-invalid={!!stateError}
        >
          <option value="">Selecciona estado</option>
          {MX_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        {stateError ? (
          <p className="text-xs text-red-600">{stateError}</p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={cityId}>Ciudad</Label>
        <Input
          id={cityId}
          name={formNames ? "city" : undefined}
          list={suggestions.length ? listId : undefined}
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className="min-h-11"
          placeholder="Ej. Monterrey"
          aria-invalid={!!cityError}
          autoComplete="address-level2"
        />
        {suggestions.length > 0 ? (
          <datalist id={listId}>
            {suggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        ) : null}
        {cityError ? (
          <p className="text-xs text-red-600">{cityError}</p>
        ) : null}
      </div>
    </div>
  );
}
