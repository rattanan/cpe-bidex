import { z } from "zod";

export const SCREENS = [
  {
    id: "exec",
    label: "แดชบอร์ดผู้บริหาร",
    group: "ภาพรวม",
    permission: "cpe.executive.view",
  },
  {
    id: "sales",
    label: "โอกาสการขาย",
    group: "สายงานขาย",
    permission: "cpe.sales.view",
  },
  {
    id: "estimate",
    label: "ประมาณราคา / BOQ",
    group: "สายงานขาย",
    permission: "cpe.estimate.view",
  },
  {
    id: "costcheck",
    label: "ตรวจต้นทุนก่อนส่งฝ่ายขาย",
    group: "สายงานขาย",
    permission: "cpe.costcheck.view",
  },
  {
    id: "bidsim",
    label: "วิเคราะห์ราคาก่อนเสนอ",
    group: "สายงานขาย",
    permission: "cpe.bidsim.view",
  },
  {
    id: "catalog",
    label: "ฐานข้อมูลต้นทุนกลาง",
    group: "ต้นทุนและจัดซื้อ",
    permission: "cpe.catalog.view",
  },
  {
    id: "forecast",
    label: "พยากรณ์ราคาวัสดุ",
    group: "ต้นทุนและจัดซื้อ",
    permission: "cpe.forecast.view",
  },
  {
    id: "procurement",
    label: "จัดซื้อและสรรหาผู้รับเหมา",
    group: "ต้นทุนและจัดซื้อ",
    permission: "cpe.procurement.view",
  },
  {
    id: "vendors",
    label: "ทะเบียนและประเมินผู้รับเหมา",
    group: "ต้นทุนและจัดซื้อ",
    permission: "cpe.vendors.view",
  },
  {
    id: "projects",
    label: "บริหารโครงการ",
    group: "หน้างานและการเงิน",
    permission: "cpe.projects.view",
  },
  {
    id: "cash",
    label: "การเงินและกระแสเงินสด",
    group: "หน้างานและการเงิน",
    permission: "cpe.cash.view",
  },
  {
    id: "knowledge",
    label: "คลังข้อมูลและ Data Master",
    group: "เรียนรู้และปรับปรุง",
    permission: "cpe.knowledge.view",
  },
] as const;
export type Screen = (typeof SCREENS)[number]["id"];
export const PROCESS = [
  ["รับแบบและศึกษาความต้องการ", "sales"],
  ["ออกแบบและทำ BOQ ต้นทุน", "estimate"],
  ["ตรวจต้นทุนเทียบงานเดิม", "costcheck"],
  ["วิเคราะห์ราคาก่อนเสนอ", "bidsim"],
  ["เสนอราคาและติดตามผล", "sales"],
  ["แยกรายการส่งขอสรรหาผู้รับเหมา", "procurement"],
  ["ขอราคา เทียบราคา และออก PO", "procurement"],
  ["ส่งมอบให้ PM บริหารโครงการ", "projects"],
  ["ประเมิน Vendor และเก็บข้อมูลปิดงาน", "knowledge"],
] as const;
export const STAGES = [
  "รับแบบ/ศึกษาความต้องการ",
  "ประมาณราคา",
  "ยื่นซองแล้ว",
  "เจรจาต่อรอง",
  "ทำสัญญา",
] as const;
export const OPPORTUNITY_STATUS = {
  active: "กำลังเสนอ",
  won: "ได้งาน",
  lost: "ไม่ได้งาน",
} as const;
export const RFQ_STATUS = {
  draft: "รวบรวมเอกสาร",
  quoting: "รอใบเสนอราคา",
  comparing: "เปรียบเทียบราคา",
  awarded: "ออก PO แล้ว",
} as const;
export const PROJECT_STATUS = {
  active: "กำลังดำเนินการ",
  closed: "ปิดงานแล้ว",
} as const;
export const DOCUMENTS = [
  "BOQ",
  "TOR",
  "แบบก่อสร้าง",
  "Specification",
  "ความปลอดภัย",
] as const;
const percent = z.coerce.number().min(0).max(99);
export const masterSchema = z
  .object({
    workTypes: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            overhead: percent,
            risk: percent,
            target: percent,
            minimum: percent,
            categories: z
              .array(z.string().trim().min(1).max(100))
              .min(1)
              .max(40),
          })
          .refine(
            (v) => v.minimum <= v.target,
            "กำไรขั้นต่ำต้องไม่เกินเป้าหมาย",
          ),
      )
      .min(1)
      .max(30),
    sectors: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          adjustment: z.coerce.number().min(-50).max(50),
        }),
      )
      .min(1)
      .max(20),
    units: z.array(z.string().trim().min(1).max(40)).min(1).max(100),
    grades: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(40),
          minimum: z.coerce.number().min(0).max(100),
        }),
      )
      .min(1)
      .max(10),
    dimensions: z
      .array(
        z.object({
          key: z
            .string()
            .regex(/^[a-z]+$/)
            .max(20),
          name: z.string().min(1).max(100),
          weight: z.coerce.number().min(0).max(100),
        }),
      )
      .length(5),
    tolerance: z.object({
      category: z.coerce.number().positive().max(100),
      total: z.coerce.number().positive().max(100),
    }),
    bidding: z.object({
      probabilityCap: z.coerce.number().positive().max(100),
      slope: z.coerce.number().positive().max(100),
      defaultPivot: z.coerce.number().min(0).lt(100),
    }),
    purchasing: z.object({
      shortValidityDays: z.coerce.number().int().positive(),
      lowScore: z.coerce.number().min(0).max(100),
    }),
    finance: z.object({
      openingCash: z.string().regex(/^\d{1,14}(\.\d{1,4})?$/),
      creditLimit: z.string().regex(/^\d{1,14}(\.\d{1,4})?$/),
    }),
  })
  .superRefine((v, ctx) => {
    if (v.dimensions.reduce((s, d) => s + d.weight, 0) !== 100)
      ctx.addIssue({
        code: "custom",
        message: "น้ำหนักประเมินต้องรวม 100%",
        path: ["dimensions"],
      });
    for (const [key, values] of [
      ["workTypes", v.workTypes.map((x) => x.name)],
      ["sectors", v.sectors.map((x) => x.name)],
      ["units", v.units],
      ["dimensions", v.dimensions.map((x) => x.key)],
      ["grades", v.grades.map((x) => x.name)],
    ] as const) {
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          message: "ข้อมูลอ้างอิงซ้ำ",
          path: [key],
        });
    }
    if (!v.grades.some((g) => g.minimum === 0))
      ctx.addIssue({
        code: "custom",
        message: "ต้องมีเกรดที่เริ่มจาก 0",
        path: ["grades"],
      });
  });
export type Master = z.infer<typeof masterSchema>;
// Reference policy from the supplied prototype. No demo business records are seeded.
export const DEFAULT_MASTER: Master = {
  workTypes: [
    {
      name: "งานก่อสร้าง",
      overhead: 6,
      risk: 3,
      target: 15,
      minimum: 12,
      categories: [
        "งานฐานราก",
        "งานโครงสร้าง",
        "งานสถาปัตยกรรม",
        "งานระบบ",
        "งานภายนอก",
      ],
    },
    {
      name: "งานโยธา",
      overhead: 5,
      risk: 5,
      target: 13,
      minimum: 10,
      categories: [
        "งานดินและเตรียมพื้นที่",
        "งานถนนและลาน",
        "งานระบายน้ำ",
        "งานป้องกันดินและงานประกอบ",
      ],
    },
    {
      name: "งาน MEP",
      overhead: 6,
      risk: 3,
      target: 16,
      minimum: 12,
      categories: [
        "งานไฟฟ้ากำลัง",
        "งานสื่อสารและควบคุม",
        "งานปรับอากาศและระบายอากาศ",
        "งานสุขาภิบาลและดับเพลิง",
        "งานทดสอบและส่งมอบ",
      ],
    },
    {
      name: "งานพลังงานทดแทน",
      overhead: 6,
      risk: 3,
      target: 18,
      minimum: 14,
      categories: [
        "งานโครงสร้างรองรับ",
        "อุปกรณ์หลัก",
        "งานไฟฟ้า",
        "งานระบบควบคุม",
        "งานทดสอบและอื่นๆ",
      ],
    },
    {
      name: "งานเครื่องจักรอุตสาหกรรม",
      overhead: 7,
      risk: 4,
      target: 17,
      minimum: 13,
      categories: [
        "งานฐานรากและโครงสร้างรองรับ",
        "เครื่องจักรและอุปกรณ์หลัก",
        "งานติดตั้งและ Alignment",
        "งานไฟฟ้าและระบบควบคุม",
        "งานทดสอบและ Commissioning",
      ],
    },
  ],
  sectors: [
    { name: "งานเอกชน", adjustment: 0 },
    { name: "งานราชการ", adjustment: -1.5 },
    { name: "งานต่างประเทศ", adjustment: -0.8 },
  ],
  units: [
    "ตร.ม.",
    "ลบ.ม.",
    "กก.",
    "ตัน",
    "ม.",
    "ต้น",
    "ชุด",
    "แผง",
    "ระบบ",
    "งาน",
    "วัน",
    "ก้อน",
    "ถุง",
    "กม.",
    "Wp",
  ],
  grades: [
    { name: "A", minimum: 85 },
    { name: "B", minimum: 75 },
    { name: "C", minimum: 65 },
    { name: "D", minimum: 0 },
  ],
  dimensions: [
    { key: "quality", name: "คุณภาพงาน", weight: 25 },
    { key: "time", name: "ส่งมอบตรงเวลา", weight: 25 },
    { key: "safety", name: "ความปลอดภัย", weight: 20 },
    { key: "price", name: "ความสามารถด้านราคา", weight: 20 },
    { key: "documents", name: "ความครบถ้วนเอกสาร", weight: 10 },
  ],
  tolerance: { category: 8, total: 5 },
  bidding: { probabilityCap: 85, slope: 2.2, defaultPivot: 15 },
  purchasing: { shortValidityDays: 15, lowScore: 75 },
  finance: { openingCash: "0", creditLimit: "0" },
};
export const WRITE_PERMISSIONS = [
  "cpe.sales.manage",
  "cpe.estimate.manage",
  "cpe.costcheck.approve",
  "cpe.bidsim.manage",
  "cpe.catalog.manage",
  "cpe.procurement.manage",
  "cpe.procurement.award",
  "cpe.vendors.manage",
  "cpe.projects.manage",
  "cpe.cash.manage",
  "cpe.master.manage",
  "cpe.improvement.propose",
  "cpe.improvement.decide",
  "cpe.sales.manage-all",
  "cpe.estimate.manage-all",
];
export const CPE_ROLE_GRANTS: Record<string, string[]> = {
  EXECUTIVE: [
    ...SCREENS.filter((s) => !["estimate", "procurement"].includes(s.id)).map(
      (s) => s.permission,
    ),
    "cpe.improvement.decide",
  ],
  KAM: [
    ...SCREENS.filter((s) =>
      ["sales", "estimate", "bidsim", "knowledge"].includes(s.id),
    ).map((s) => s.permission),
    "cpe.sales.manage",
    "cpe.bidsim.manage",
    "cpe.improvement.propose",
  ],
  ESTIMATOR: [
    ...SCREENS.filter((s) =>
      [
        "estimate",
        "costcheck",
        "bidsim",
        "catalog",
        "forecast",
        "procurement",
        "knowledge",
      ].includes(s.id),
    ).map((s) => s.permission),
    "cpe.estimate.manage",
    "cpe.costcheck.approve",
    "cpe.catalog.manage",
    "cpe.improvement.propose",
  ],
  PROCUREMENT: [
    ...SCREENS.filter((s) =>
      ["catalog", "forecast", "procurement", "vendors", "knowledge"].includes(
        s.id,
      ),
    ).map((s) => s.permission),
    "cpe.catalog.manage",
    "cpe.procurement.manage",
    "cpe.procurement.award",
    "cpe.vendors.manage",
    "cpe.improvement.propose",
  ],
  PROJECT_MANAGER: [
    ...SCREENS.filter((s) =>
      ["vendors", "projects", "cash"].includes(s.id),
    ).map((s) => s.permission),
    "cpe.vendors.manage",
    "cpe.projects.manage",
    "cpe.cash.manage",
  ],
};
CPE_ROLE_GRANTS.PRESALES = CPE_ROLE_GRANTS.ESTIMATOR;
CPE_ROLE_GRANTS.SALES_DIRECTOR = CPE_ROLE_GRANTS.KAM;
CPE_ROLE_GRANTS.TEAM_MANAGER = CPE_ROLE_GRANTS.KAM;
for (const role of ["ADMIN", "SYSTEM_ADMIN"])
  CPE_ROLE_GRANTS[role] = [
    ...SCREENS.map((s) => s.permission),
    ...WRITE_PERMISSIONS,
  ];
export const CPE_ROLE_LABELS: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
  EXECUTIVE: "ผู้บริหาร",
  KAM: "ฝ่ายขาย",
  SALES_DIRECTOR: "ผู้อำนวยการฝ่ายขาย",
  TEAM_MANAGER: "หัวหน้าทีมขาย",
  PRESALES: "วิศวกรรมประมาณราคา",
  ESTIMATOR: "วิศวกรรมประมาณราคา",
  PROCUREMENT: "ฝ่ายจัดซื้อ",
  PROJECT_MANAGER: "PM โครงการ",
};
