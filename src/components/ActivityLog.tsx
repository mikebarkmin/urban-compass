import { LogEntry } from "../../game/logic";
import { getCitySet } from "../../game/citySets";
import { ALL_CATEGORIES, Category } from "../../game/cities";
import { useLocale, type Params, type TFunction } from "@/i18n";
import { Panel } from "./ui";

const timeOf = (dt: number, locale: string) =>
  new Date(dt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

const isCategory = (value: unknown): value is Category =>
  typeof value === "string" && (ALL_CATEGORIES as string[]).includes(value);

/**
 * Log lines arrive as a key and raw values. A couple of those values are
 * themselves translatable — a city set id, a card name — so they are resolved
 * before the sentence is built.
 */
const resolveParams = (t: TFunction, params?: Params): Params | undefined => {
  if (!params) return params;
  const resolved: Params = { ...params };

  // `set` is a built-in set id; `setId`/`setName` is the pair a round start
  // carries, where an uploaded set has a name but no translation.
  if (typeof params.set === "string" && getCitySet(params.set)) {
    resolved.set = t(`set.${params.set}.name`);
  }
  if (typeof params.setId === "string") {
    resolved.set = getCitySet(params.setId)
      ? t(`set.${params.setId}.name`)
      : String(params.setName ?? params.setId);
  }
  if (isCategory(params.category)) {
    resolved.category = t(`card.${params.category}.short`).toLowerCase();
  }

  return resolved;
};

const ActivityLog = ({ log }: { log: LogEntry[] }) => {
  const { locale, t } = useLocale();

  return (
    <Panel title={t("activity.title")}>
      <ul className="thin-scroll max-h-64 space-y-1.5 overflow-y-auto pr-1 text-xs">
        {log.length === 0 && <li className="text-chart-600">{t("activity.empty")}</li>}
        {log.map((entry) => (
          <li key={entry.id} className="flex animate-appear gap-2 text-chart-400">
            <span className="shrink-0 font-mono text-[10px] text-chart-600">
              {timeOf(entry.dt, locale)}
            </span>
            <span className="text-chart-300">{t(entry.key, resolveParams(t, entry.params))}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
};

export default ActivityLog;
