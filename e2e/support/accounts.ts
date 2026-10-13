// Accounts, ids and texts from docs/seed-spec.md (frozen). Passwords come from env, never from code.
export type Role = "employee" | "manager";

export interface Account {
  email: string;
  name: string;
  role: Role;
  company: string;
  userId: string;
}

export const NORTHSTAR = "Northstar Labs";
export const HARBOR = "Harbor Works";
export const FIXTURE_CO = "Fixture Co";
export const FIXTURE_CO_ID = "93d3e72c-a081-4027-a2bb-090a95679d04";

export const alex: Account = { email: "alex@northstar.example", name: "Alex Morgan", role: "employee", company: NORTHSTAR, userId: "2bc1188c-bc4c-4dc3-8536-0b3c667a7977" };
export const sam: Account = { email: "sam@northstar.example", name: "Sam Rivera", role: "employee", company: NORTHSTAR, userId: "a66ad261-6322-43d0-b2fa-307c87e52f69" };
export const jordan: Account = { email: "jordan@northstar.example", name: "Jordan Lee", role: "manager", company: NORTHSTAR, userId: "3f78235c-d9b2-4dac-8767-79f4bbe833c2" };
export const taylor: Account = { email: "taylor@northstar.example", name: "Taylor Chen", role: "manager", company: NORTHSTAR, userId: "26a6e77c-e9dd-4256-a564-237acf4fef97" };
export const casey: Account = { email: "casey@harbor.example", name: "Casey Patel", role: "employee", company: HARBOR, userId: "eb530f0d-6203-4590-9663-61752e919c5b" };
export const riley: Account = { email: "riley@harbor.example", name: "Riley Brooks", role: "manager", company: HARBOR, userId: "1f8ff934-0277-4387-9b97-e7cf0bcfb6a2" };
export const mia: Account = { email: "mia@fixture.example", name: "Mia Fischer", role: "employee", company: FIXTURE_CO, userId: "ee3a02f0-4859-4943-ae9c-c5c612d32819" };
export const eli: Account = { email: "eli@fixture.example", name: "Eli Novak", role: "employee", company: FIXTURE_CO, userId: "d8cc72ba-e377-46d8-ba1c-183d8cf1529c" };
export const ola: Account = { email: "ola@fixture.example", name: "Ola Berg", role: "manager", company: FIXTURE_CO, userId: "c70dcefb-02f8-4241-ada7-e1e6d4cd3c45" };
export const noa: Account = { email: "noa@fixture.example", name: "Noa Weiss", role: "employee", company: FIXTURE_CO, userId: "c91fb8fb-0574-4902-a5f0-6d94f73fa6d9" };

export const demoAccounts: readonly Account[] = [alex, sam, jordan, taylor, casey, riley];

export interface SeedRequest {
  key: string;
  id: string;
  title: string;
  vendor: string;
  amount: string; // exact stored string
  description: string;
  status: "pending" | "approved" | "rejected";
  requester: Account;
  submittedText: RegExp; // formatted "D Mon YYYY, HH:MM UTC" (day may or may not be zero padded)
  decidedBy?: Account;
  decidedText?: RegExp;
  rejectionReason?: string;
}

export const seed: Record<"N1" | "N2" | "N3" | "N4" | "N5" | "N6" | "H1" | "H2", SeedRequest> = {
  N1: { key: "N1", id: "86935e09-143b-482a-bf3c-f7400bc4b6de", title: "Standing desk for design team", vendor: "Ergo Office Supply", amount: "649.00", description: "Two sit-stand desks, 160 cm wide.\nNeeded for the new design hires starting next week.\nDelivery to the 3rd floor.", status: "pending", requester: alex, submittedText: /1 Oct 2026, 09:15 UTC/ },
  N2: { key: "N2", id: "c24bfa1c-bfe6-4a3e-aa16-94a938408533", title: "Annual design tool licenses", vendor: "Pixelforge Software", amount: "4200.00", description: "Renewal of 5 seats for the design team.", status: "pending", requester: alex, submittedText: /2 Oct 2026, 13:40 UTC/ },
  N3: { key: "N3", id: "3abb0e19-9e9b-4175-927d-b4267f6b614b", title: "Team offsite catering", vendor: "Green Fork Catering", amount: "1250.50", description: "Lunch for 24 people at the quarterly offsite.", status: "pending", requester: sam, submittedText: /3 Oct 2026, 08:05 UTC/ },
  N4: { key: "N4", id: "5d3c1a76-ac3f-4038-bade-975bf75a06ce", title: "Conference travel for Q4 summit", vendor: "Skyway Travel", amount: "2380.75", description: "Flights and hotel for two people attending the summit.", status: "pending", requester: jordan, submittedText: /4 Oct 2026, 16:20 UTC/ },
  N5: { key: "N5", id: "d21a4ea9-e5d4-4be4-b55e-10e0c70b37ea", title: "Laptop replacement", vendor: "Byte Hardware Direct", amount: "1899.99", description: "Current laptop is out of warranty and failing.", status: "approved", requester: alex, submittedText: /28 Sep 2026, 10:00 UTC/, decidedBy: jordan, decidedText: /29 Sep 2026, 11:30 UTC/ },
  N6: { key: "N6", id: "35aba7f5-7773-4599-a72d-5403282a3f07", title: "Premium coffee machine", vendor: "Barista Pro Equipment", amount: "3299.00", description: "Espresso machine for the shared kitchen.", status: "rejected", requester: sam, submittedText: /26 Sep 2026, 14:10 UTC/, decidedBy: jordan, decidedText: /27 Sep 2026, 09:45 UTC/, rejectionReason: "Budget for office equipment is exhausted this quarter." },
  H1: { key: "H1", id: "0d02dd1a-0b66-4756-a86d-724d1706d19a", title: "Warehouse safety gloves", vendor: "SafeGrip Supplies", amount: "312.40", description: "Replacement gloves for the loading dock crew.", status: "pending", requester: casey, submittedText: /5 Oct 2026, 07:30 UTC/ },
  H2: { key: "H2", id: "58cbac00-1ad9-4906-9d31-ce978c20a514", title: "Pallet jack maintenance contract", vendor: "Dockside Services", amount: "780.00", description: "Yearly service contract for two pallet jacks.", status: "approved", requester: casey, submittedText: /30 Sep 2026, 12:00 UTC/, decidedBy: riley, decidedText: /1 Oct 2026, 08:20 UTC/ },
};

export const northstarSeed = [seed.N1, seed.N2, seed.N3, seed.N4, seed.N5, seed.N6] as const;
export const harborSeed = [seed.H1, seed.H2] as const;
