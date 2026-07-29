import type { ServiceLocation } from "@/lib/types";

export const categoryTaxonomyHints = [
  "Pain Relief",
  "Cold & Flu",
  "Diabetes Care",
  "Cardiac Care",
  "Digestive Health",
  "Vitamins & Supplements",
  "Skin Care",
  "First Aid",
  "Respiratory Care",
  "Women's Health",
  "Child Care",
  "Eye & Ear Care",
  "Personal Care",
  "Chronic Care",
] as const;

export const serviceLocations: ServiceLocation[] = [
  {
    id: "dibiyapur",
    label: "Dibiyapur",
    city: "Dibiyapur",
    state: "Uttar Pradesh",
    pincode: "209302",
    latitude: 26.635833,
    longitude: 79.573333,
    deliveryRadiusKm: 6,
  },
];
