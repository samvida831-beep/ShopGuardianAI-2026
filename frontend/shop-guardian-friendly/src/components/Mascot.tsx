import maleImg from "@/assets/shopkeeper-male.png";
import femaleImg from "@/assets/shopkeeper-female.png";
import familyImg from "@/assets/shopkeeper-family.png";
import robotImg from "@/assets/ai-robot.png";
import type { Avatar } from "@/lib/shop-store";

const map = { male: maleImg, female: femaleImg, family: familyImg };

export function AiRobot({ size = 96, className = "", float = true }: { size?: number; className?: string; float?: boolean }) {
  return (
    <img
      src={robotImg}
      alt="ShopGuardian AI assistant robot"
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className={`object-contain drop-shadow-[0_10px_24px_rgba(37,99,235,0.25)] ${float ? "animate-float" : ""} animate-blink ${className}`}
    />
  );
}

export function Mascot({
  avatar,
  size = 160,
  className = "",
  float = false,
}: {
  avatar: Avatar;
  size?: number;
  className?: string;
  float?: boolean;
}) {
  return (
    <img
      src={map[avatar]}
      alt="ShopGuardian mascot"
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className={`object-contain drop-shadow-sm ${float ? "animate-float" : ""} ${className}`}
    />
  );
}

export const mascotOptions: { key: Avatar; label: string; description: string }[] = [
  { key: "male", label: "Male Shopkeeper", description: "A friendly shopkeeper standing by his shop." },
  { key: "female", label: "Female Shopkeeper", description: "A cheerful shopkeeper ready to welcome customers." },
  { key: "family", label: "Family Shop", description: "A husband and wife running the shop together." },
];