import Head from "next/head";

import Archive from "@/components/Archive";
import Layout from "@/components/Layout";
import { useT } from "@/i18n";

export default function ArchivePage() {
  const t = useT();

  return (
    <>
      <Head>
        <title>{`${t("app.name")} · ${t("archive.title")}`}</title>
        <meta name="description" content={t("archive.lede")} />
      </Head>

      <Layout>
        <Archive />
      </Layout>
    </>
  );
}
