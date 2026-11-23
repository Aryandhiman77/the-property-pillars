import {FaFacebook, FaInstagram, FaLinkedin, FaWhatsapp, FaYoutube} from "react-icons/fa";
import {FaXTwitter} from "react-icons/fa6";
import type {ArticleSocialPlatform} from "@the-property-pillar/contracts";

export const socialIcons = {
  whatsapp: {name: "WhatsApp", Icon: FaWhatsapp, color: "#138748"},
  facebook: {name: "Facebook", Icon: FaFacebook, color: "#1461c5"},
  instagram: {name: "Instagram", Icon: FaInstagram, color: "#b03175"},
  linkedin: {name: "LinkedIn", Icon: FaLinkedin, color: "#0b66a0"},
  youtube: {name: "YouTube", Icon: FaYoutube, color: "#cb2531"},
  x: {name: "X", Icon: FaXTwitter, color: "#27312d"},
} satisfies Record<ArticleSocialPlatform, {name: string; Icon: typeof FaWhatsapp; color: string}>;
