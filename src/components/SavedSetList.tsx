import { SavedCitySet, deleteSavedSet } from "@/data/savedSets";
import { exportKmz } from "@/utils/kmzExport";
import { useLocale } from "@/i18n";
import { Badge, Button, cx } from "./ui";

interface SavedSetListProps {
  sets: SavedCitySet[];
  /** The set currently in use, so it can be marked. */
  activeName?: string;
  /** Editing is locked for a guest in a room; always open on its own page. */
  locked?: boolean;
  onEdit: (set: SavedCitySet) => void;
  /** Called with the remaining sets after a deletion. */
  onChange: (sets: SavedCitySet[]) => void;
}

/**
 * The sets saved in this browser. Shared by the lobby's city-set picker and the
 * standalone editor page, so a set saved in one shows up in the other.
 */
const SavedSetList = ({
  sets,
  activeName,
  locked,
  onEdit,
  onChange,
}: SavedSetListProps) => {
  const { t } = useLocale();

  if (sets.length === 0) return null;

  return (
    <div className="rounded-xl border border-chart-700 bg-chart-850/40 p-4">
      <div className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-chart-500 uppercase">
        {t("saved.title")}
      </div>
      <ul className="space-y-2">
        {sets.map((set) => {
          const isActive = activeName !== undefined && set.name === activeName;

          return (
            <li key={set.id} className="space-y-2">
              <div
                className={cx(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors",
                  isActive
                    ? "border-beacon-500/60 bg-beacon-500/10"
                    : "border-chart-800 bg-chart-900/50",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-semibold text-chart-100">
                      {set.name}
                    </span>
                    {isActive && <Badge tone="beacon">{t("picker.upload.inUse")}</Badge>}
                  </div>
                  <div className="text-[11px] text-chart-500">
                    {t("picker.cities", { count: set.cities.length })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void exportKmz(set.name, set.cities)}
                  >
                    {t("saved.export")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={locked}
                    onClick={() => onEdit(set)}
                  >
                    {t("saved.load")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(deleteSavedSet(set.id))}
                  >
                    {t("saved.delete")}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SavedSetList;
