export type Medicine = {
  id: string;
  slug: string;
  name: string;
  category: string;
  manufacturer: string;
  image: string;
  packSize: string;
  price: number;
  mrp: number;
  discount: number;
  stockStatus: string;
  /** Integer count of units on hand. Atomic-decrement on order placement. */
  stockOnHand?: number;
  requiresPrescription: boolean;
  rating: number;
  reviewCount: number;
  deliveryText: string;
  shortDescription: string;
  description: string;
};

export type OrderStatus =
  | "Ordered"
  | "Packed"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

/** Statuses from which the customer can self-cancel without admin help. */
export const CUSTOMER_CANCELLABLE_STATUSES: ReadonlyArray<OrderStatus> = [
  "Ordered",
  "Packed",
];

/** Terminal statuses — no further forward transitions are allowed. */
export const TERMINAL_ORDER_STATUSES: ReadonlyArray<OrderStatus> = [
  "Delivered",
  "Cancelled",
];

/** Pre-defined cancellation reasons offered to the customer. */
export const CANCEL_REASONS = [
  "Changed my mind",
  "Ordered by mistake",
  "Delivery taking too long",
  "Found cheaper elsewhere",
  "Wrong items in cart",
  "Other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export type ServiceLocation = {
  id: string;
  label: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  deliveryRadiusKm?: number;
};

export type LocationDetectionSource = "manual" | "browser";

export type LocationStatus =
  | "idle"
  | "detecting"
  | "matched"
  | "outside_radius"
  | "permission_denied"
  | "unavailable";

export type PersistedLocationState = {
  selectedLocationId: string;
  selectedLocationLabel: string;
  source: LocationDetectionSource;
  isServiceable: boolean;
  status: LocationStatus;
  message?: string;
};

/* ── Rider applications ──────────────────────────────────────────────────── */

export const VEHICLE_TYPES = ["bike", "scooter", "e-scooter", "cycle"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const AVAILABILITY_OPTIONS = [
  "Full time",
  "Part time",
  "Weekends only",
  "Evenings only",
] as const;
export type Availability = (typeof AVAILABILITY_OPTIONS)[number];

export const PREFERRED_SHIFTS = [
  "Morning (8am - 1pm)",
  "Afternoon (1pm - 6pm)",
  "Evening (6pm - 11pm)",
  "Flexible",
] as const;
export type PreferredShift = (typeof PREFERRED_SHIFTS)[number];

export const RIDER_APP_SOURCES = [
  "Google search",
  "WhatsApp / friend",
  "Poster / flyer",
  "Existing rider referral",
  "Other",
] as const;

export const RIDER_APP_STATUSES = [
  "submitted",
  "under_review",
  "on_hold",
  "approved",
  "rejected",
] as const;
export type RiderApplicationStatus = (typeof RIDER_APP_STATUSES)[number];

/** Map of document kind → public-safe label. */
export const RIDER_APP_DOC_KINDS = [
  "photo",
  "aadhaarFront",
  "aadhaarBack",
  "licence",
  "rc",
  "pan",
] as const;
export type RiderAppDocKind = (typeof RIDER_APP_DOC_KINDS)[number];

export type RiderApplicationDoc = {
  blobUrl: string;
  blobPathname: string;
  contentType: string;
  size: number;
};

export type RiderApplication = {
  id: string;
  phone: string;
  fullName: string;
  dob: string;
  gender?: "male" | "female" | "other";
  currentAddress: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;

  vehicleType: VehicleType;
  vehicleNumber: string;
  aadhaarLast4: string;

  upiId?: string;
  availability: Availability;
  preferredShift: PreferredShift;
  hoursPerWeek?: number;
  source?: string;

  status: RiderApplicationStatus;
  rejectionReason?: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;

  docs: Partial<Record<RiderAppDocKind, RiderApplicationDoc>>;

  submittedAt: string;
  updatedAt: string;
};
