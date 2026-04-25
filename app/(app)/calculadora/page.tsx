import { getCalculatorPageData } from "@/lib/server/app-data";

import { CalculatorWorkspace } from "./calculator-workspace";

export default async function CalculatorPage() {
  const data = await getCalculatorPageData();

  return <CalculatorWorkspace bookmakers={data.bookmakers} />;
}
