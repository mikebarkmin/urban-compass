import Head from "next/head";
import Link from "next/link";

import Layout from "@/components/Layout";
import { Glyph } from "@/components/Glyph";
import { Rich, useT } from "@/i18n";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-2">
    <h2 className="font-display text-base font-semibold text-chart-100">
      {title}
    </h2>
    {children}
  </section>
);

const CodeBlock = ({ children }: { children: string }) => (
  <pre className="thin-scroll overflow-x-auto rounded-lg border border-chart-700 bg-chart-900/70 p-3 text-[11px] leading-relaxed text-chart-300">
    <code>{children}</code>
  </pre>
);

export default function HelpPage() {
  const t = useT();

  return (
    <>
      <Head>
        <title>{`${t("app.name")} · ${t("help.title")}`}</title>
        <meta name="description" content={t("help.lede")} />
      </Head>

      <Layout>
        <div className="mx-auto max-w-2xl space-y-6 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {t("help.title")}
              </h1>
              <p className="mt-1 text-sm text-chart-400">
                <Rich k="help.lede" />
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-chart-400 underline underline-offset-4 hover:text-chart-200"
            >
              <Glyph name="arrow-left" /> {t("help.back")}
            </Link>
          </div>

          <Section title={t("help.accepted.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.accepted.body" />
            </p>
          </Section>

          <Section title={t("help.googleEarth.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.googleEarth.body" />
            </p>
          </Section>

          <Section title={t("help.googleMyMaps.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.googleMyMaps.body" />
            </p>
          </Section>

          <Section title={t("help.hand.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.hand.body" />
            </p>
          </Section>

          <Section title={t("help.structure.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.structure.body" />
            </p>
          </Section>

          <Section title={t("help.point.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.point.body" />
            </p>
            <CodeBlock>{`<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>My Cities</name>
    <Placemark>
      <name>Barcelona</name>
      <Point>
        <coordinates>2.17,41.38</coordinates>
      </Point>
      <ExtendedData>
        <Data name="population">
          <value>1604555</value>
        </Data>
      </ExtendedData>
    </Placemark>
  </Document>
</kml>`}</CodeBlock>
          </Section>

          <Section title={t("help.columns.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.columns.body" />
            </p>
            <CodeBlock>{`<Placemark>
  <name>Barcelona</name>
  <ExtendedData>
    <Data name="latitude">
      <value>41.38</value>
    </Data>
    <Data name="longitude">
      <value>2.17</value>
    </Data>
    <Data name="population">
      <value>1604555</value>
    </Data>
    <Data name="country">
      <value>ES</value>
    </Data>
  </ExtendedData>
</Placemark>`}</CodeBlock>
          </Section>

          <Section title={t("help.coordFormat.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.coordFormat.body" />
            </p>
          </Section>

          <Section title={t("help.fields.title")}>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="font-medium text-chart-200">name</dt>
                <dd className="text-chart-400">{t("help.fields.name")}</dd>
              </div>
              <div>
                <dt className="font-medium text-chart-200">
                  latitude, longitude
                </dt>
                <dd className="text-chart-400">
                  {t("help.fields.coordinates")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-chart-200">population</dt>
                <dd className="text-chart-400">
                  {t("help.fields.population")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-chart-200">country</dt>
                <dd className="text-chart-400">{t("help.fields.country")}</dd>
              </div>
              <div>
                <dt className="font-medium text-chart-200">elevation</dt>
                <dd className="text-chart-400">
                  {t("help.fields.elevation")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-chart-200">nameDe</dt>
                <dd className="text-chart-400">{t("help.fields.nameDe")}</dd>
              </div>
            </dl>
          </Section>

          <Section title={t("help.skipped.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.skipped.body" />
            </p>
          </Section>

          <Section title={t("help.escapes.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.escapes.body" />
            </p>
          </Section>

          <Section title={t("help.sample.title")}>
            <p className="text-sm leading-relaxed text-chart-400">
              <Rich k="help.sample.body" />
            </p>
          </Section>
        </div>
      </Layout>
    </>
  );
}
