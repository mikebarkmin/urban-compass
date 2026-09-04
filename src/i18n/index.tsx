import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { de, en, type MessageKey } from "./dictionaries";

export type Locale = "en" | "de";

export const LOCALES: Locale[] = ["en", "de"];

/** Each language named in itself, which is how language pickers should read. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
};

const DICTIONARIES: Record<Locale, Record<string, string>> = { en, de };

const STORAGE_KEY = "urban-guessr:locale";

export type Params = Record<string, string | number>;

const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as string[]).includes(value);

/** Substitute `{name}` placeholders. Anything unmatched is left alone. */
const interpolate = (template: string, params?: Params): string =>
  params
    ? template.replace(/\{(\w+)\}/g, (whole, name: string) =>
        params[name] === undefined ? whole : String(params[name]),
      )
    : template;

/**
 * Look a message up, falling back to English and then to the key itself so a
 * missing translation degrades to something readable rather than blank.
 *
 * A `count` parameter selects between `key_one` and `key_other` when those
 * exist; English and German split plurals the same way, so one rule covers both.
 */
export const translate = (locale: Locale, key: string, params?: Params): string => {
  const dictionary = DICTIONARIES[locale] ?? en;

  if (params && typeof params.count === "number") {
    const plural = `${key}_${params.count === 1 ? "one" : "other"}`;
    const found = dictionary[plural] ?? en[plural as MessageKey];
    if (found) return interpolate(found, params);
  }

  const found = dictionary[key] ?? en[key as MessageKey];
  return found === undefined ? key : interpolate(found, params);
};

export type TFunction = (key: string, params?: Params) => string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TFunction;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, params) => translate("en", key, params),
});

/** The browser's preference, used only until the player picks for themselves. */
const detectLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can be switched off; the browser language is a fine fallback.
  }
  return window.navigator?.language?.toLowerCase().startsWith("de") ? "de" : "en";
};

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  // The server has no way to know the player's language, so the first render is
  // always English and the real choice is applied once mounted. Anything else
  // would mismatch the server markup during hydration.
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== "en") setLocaleState(detected);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not worth failing over.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => useContext(LocaleContext);

/** The common case: just the translate function. */
export const useT = (): TFunction => useContext(LocaleContext).t;

/**
 * Render a message that carries `<em>` emphasis. Only `<em>` is understood —
 * the strings are ours, not user input, and a full markup parser would be a
 * liability for no gain.
 */
export const Rich = ({ k, params }: { k: string; params?: Params }) => {
  const { locale } = useLocale();
  const text = translate(locale, k, params);

  return (
    <>
      {text.split(/(<em>.*?<\/em>)/g).map((part, index) =>
        part.startsWith("<em>") ? (
          <em key={index} className="text-chart-100">
            {part.slice(4, -5)}
          </em>
        ) : (
          part
        ),
      )}
    </>
  );
};
