import z from "zod";

export const MCP_PROMPT_DEFINITIONS = [
  {
    name: "wallet_ofac_screening_brief",
    title: "Wallet OFAC Screening Brief",
    description: "Prepare a wallet-address OFAC screening request and response brief.",
    arguments: [
      {
        name: "address",
        description: "Wallet address to screen.",
        required: true,
      },
      {
        name: "asset",
        description: "Optional asset or network ticker context.",
        required: false,
      },
    ],
    argsSchema: {
      address: z.string().min(10).describe("Wallet address to screen."),
      asset: z.string().optional().describe("Optional asset or network ticker context."),
    },
    handler: async ({ address, asset }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Use the ofac_wallet_screen tool to screen wallet "${address}"` +
              (asset ? ` with asset context "${asset}"` : "") +
              ". Return whether the wallet is a hit or clear, the sanctioned entity if matched, and a concise allow, pause, or block recommendation.",
          },
        },
      ],
    }),
  },
  {
    name: "decision_report_brief",
    title: "Decision Report Brief",
    description: "Prepare a Monte Carlo decision report request.",
    arguments: [
      {
        name: "analysis_type",
        description: "Simulation workflow to summarize.",
        required: true,
      },
      {
        name: "decision_title",
        description: "Optional report title.",
        required: false,
      },
      {
        name: "objective",
        description: "Optional decision objective or review context.",
        required: false,
      },
    ],
    argsSchema: {
      analysis_type: z.enum([
        "probability",
        "batch-probability",
        "compare",
        "sensitivity",
        "forecast",
        "composed",
        "optimize",
      ]).describe("Simulation workflow to summarize."),
      decision_title: z.string().optional().describe("Optional report title."),
      objective: z.string().optional().describe("Optional decision objective or review context."),
    },
    handler: async ({ analysis_type, decision_title, objective }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Use the monte_carlo_decision_report tool with analysis_type "${analysis_type}".` +
              (decision_title ? ` Title the report "${decision_title}".` : "") +
              (objective ? ` Focus the summary on "${objective}".` : "") +
              " Return executive summary bullets, headline metrics, and tables suitable for review.",
          },
        },
      ],
    }),
  },
  {
    name: "report_artifact_brief",
    title: "Report Artifact Brief",
    description: "Prepare a PDF or DOCX report rendering request.",
    arguments: [
      {
        name: "format",
        description: "Artifact format to generate.",
        required: true,
      },
      {
        name: "title",
        description: "Optional report title.",
        required: false,
      },
      {
        name: "audience",
        description: "Optional audience or review context.",
        required: false,
      },
    ],
    argsSchema: {
      format: z.enum(["pdf", "docx"]).describe("Artifact format to generate."),
      title: z.string().optional().describe("Optional report title."),
      audience: z.string().optional().describe("Optional audience or review context."),
    },
    handler: async ({ format, title, audience }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Render the current report payload with the ${format === "pdf" ? "report_pdf_generate" : "report_docx_generate"} tool.` +
              (title ? ` Use the title "${title}".` : "") +
              (audience ? ` The intended audience is "${audience}".` : "") +
              " Return the generated artifact and file metadata.",
          },
        },
      ],
    }),
  },
];
