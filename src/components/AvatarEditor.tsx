import type { AvatarSpec } from "../data/types";
import { Avatar } from "./Avatar";
export function AvatarEditor({
  value,
  onChange,
}: {
  value: AvatarSpec;
  onChange: (v: AvatarSpec) => void;
}) {
  const colors = {
    skin: ["#f0c9a7", "#d7a077", "#b87f53", "#986443", "#714832", "#4a3027"],
    hair: ["#201e21", "#503629", "#9c603a", "#bc8654", "#e6c68b", "#854f91"],
    shirt: ["#4669d8", "#d9667c", "#789b5c", "#e9a94e", "#333333", "#bc83c8"],
    background: [
      "#ded8fc",
      "#cce3bc",
      "#ffe4b5",
      "#f7d7df",
      "#c9e6ed",
      "#e5e5e5",
    ],
  };
  return (
    <div className="avatar-editor">
      <Avatar spec={value} />
      {Object.entries(colors).map(([field, values]) => (
        <fieldset key={field}>
          <legend>
            {field === "shirt"
              ? "Clothing"
              : field === "background"
                ? "Background"
                : field === "skin"
                  ? "Skin tone"
                  : "Hair colour"}
          </legend>
          <div className="swatches">
            {values.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`${field} ${color}`}
                aria-pressed={value[field as keyof AvatarSpec] === color}
                style={{ background: color }}
                onClick={() => onChange({ ...value, [field]: color })}
              />
            ))}
          </div>
        </fieldset>
      ))}
      <label className="field">
        Hair style
        <select
          value={value.style}
          onChange={(e) =>
            onChange({ ...value, style: e.target.value as AvatarSpec["style"] })
          }
        >
          <option value="crop">Short crop</option>
          <option value="waves">Waves</option>
          <option value="long">Long hair</option>
          <option value="bun">Bun</option>
        </select>
      </label>
      <label className="field">
        Eyes
        <select
          value={value.eyes}
          onChange={(e) =>
            onChange({ ...value, eyes: e.target.value as AvatarSpec["eyes"] })
          }
        >
          <option value="happy">Happy</option>
          <option value="round">Round</option>
          <option value="sleepy">Relaxed</option>
        </select>
      </label>
      <label className="field">
        Accessories
        <select
          value={value.accessory}
          onChange={(e) =>
            onChange({
              ...value,
              accessory: e.target.value as AvatarSpec["accessory"],
            })
          }
        >
          <option value="none">None</option>
          <option value="glasses">Glasses</option>
          <option value="earrings">Earrings</option>
        </select>
      </label>
      <p className="fine">
        Original avatar artwork, saved only on this device.
      </p>
    </div>
  );
}
