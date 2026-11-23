import {createHmac} from "node:crypto";
import {isIP} from "node:net";
import {env} from "../config/env.js";
import {workspacePrisma} from "./db.js";

export function propertyVisitorHash(tenantId: string, propertyId: string, ip: string | undefined) {
  if (!ip || !isIP(ip)) return undefined;
  let address = ip;
  if (isIP(ip) === 6) {
    address = new URL(`http://[${ip.split("%", 1)[0]}]`).hostname.slice(1, -1);
    const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/i.exec(address);
    if (mapped) {
      const high = Number.parseInt(mapped[1]!, 16);
      const low = Number.parseInt(mapped[2]!, 16);
      address = [high >> 8, high & 255, low >> 8, low & 255].join(".");
    }
  }
  return createHmac("sha256", env.JWT_SECRET).update(JSON.stringify(["property-view", tenantId, propertyId, address])).digest("hex");
}

export async function propertyViewCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await workspacePrisma.propertyView.groupBy({by: ["propertyId"], where: {propertyId: {in: ids}}, _count: true});
  return new Map(rows.map(({propertyId, _count}) => [propertyId, _count]));
}
