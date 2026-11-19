import {z} from "zod";
import {postalPincodeService} from "../locations/service.js";
import {ApiError} from "../utils/api-error.js";
import {defaultListingCountry} from "./listing-geography.js";

export const jobPostalCode = z.string({required_error: "Enter the job PIN code.", invalid_type_error: "Enter the job PIN code."}).regex(
  /^[1-9]\d{5}$/, "Enter a valid six-digit Indian PIN code.",
);

export async function resolveJobLocation(data: Record<string, unknown>, previous?: Record<string, unknown>) {
  if ((data.countryCode ?? defaultListingCountry) !== defaultListingCountry) return data;
  const postalCode = z.object({postalCode: jobPostalCode}).parse(data).postalCode;
  if (previous?.postalCode === postalCode && (previous.countryCode ?? defaultListingCountry) === defaultListingCountry && previous.state && previous.city) {
    return {...data, state: previous.state, city: previous.city};
  }

  try {
    const {state, city, area, areas} = await postalPincodeService.lookup(postalCode);
    const requestedArea = typeof data.locality === "string" && areas.includes(data.locality) ? data.locality : area;
    return {...data, state, city, locality: requestedArea};
  } catch (error) {
    if (error instanceof ApiError) {
      throw new z.ZodError([{code: "custom", path: ["postalCode"], message: error.message}]);
    }
    throw error;
  }
}
