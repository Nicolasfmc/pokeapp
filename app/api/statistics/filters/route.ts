import { requireUser } from "@/server/auth";
import {
  getStatisticsFilterOptions,
  handleStatisticsError,
  jsonOk,
} from "@/modules/statistics";

export async function GET() {
  try {
    const user = await requireUser();
    const options = await getStatisticsFilterOptions(user.id);
    return jsonOk(options);
  } catch (error) {
    return handleStatisticsError(error);
  }
}
