/** Original editorial starters. Import into News/Translation so the CMS remains the source of truth. */
export const starterBlogCategories = [
  { slug: "industry-guides", name: "Industry Guides", zhName: "行业指南", sortOrder: 6 },
  { slug: "oem-guides", name: "OEM Project Guides", zhName: "OEM 项目指南", sortOrder: 7 },
  { slug: "buying-guides", name: "B2B Buying Guides", zhName: "B2B 采购指南", sortOrder: 8 },
];

export const starterBlogArticles = [
  {
    slug: "how-to-choose-power-bank-manufacturer",
    categorySlug: "buying-guides",
    title: "How to Choose a Power Bank Manufacturer for Your Brand",
    seoTitle: "How to Choose a Power Bank Manufacturer | B2B Guide",
    metaDescription: "Compare power bank manufacturers using a practical B2B checklist: product requirements, sample approval, quality evidence, OEM scope and commercial terms.",
    excerpt: "A practical sourcing framework for brands and distributors comparing a power bank manufacturer, from the first project brief to an approved production sample.",
    author: "Shanze Editorial",
    content: `Choosing a power bank manufacturer is easier when every candidate receives the same project brief. A headline price rarely explains the cell specification, charging behavior, packaging scope or inspection criteria behind the quotation. Start by defining what your customer needs, then compare the evidence each supplier can provide.

## Define the product before requesting a price

Describe the intended user and sales channel. A travel accessory, a branded corporate gift and a retail charging product may require different designs and packaging. Share your target countries, preferred size and weight, capacity requirement, port layout and supported charging functions. If a requirement is still open, identify it as a decision to make rather than a confirmed specification.

- Product format: wired, magnetic or another agreed design.
- Target devices and the charging functions you want to verify.
- Planned first order and possible repeat-order range.
- Logo method, colors, packaging and included accessories.
- Target market, sample deadline and intended launch window.

Our [power bank manufacturer page](/power-bank-manufacturer) introduces the project discussion, while the [product catalog](/products) helps you shortlist currently published models. Confirm the specifications of the selected model directly before approving an order.

## Compare manufacturing scope and evidence

Ask whether the supplier is offering an existing model with your brand, a modification to an existing design or a new development project. These routes can involve different tooling, validation work and ownership arrangements. Ask who owns the tooling and artwork, what changes are included, and who handles a future engineering change.

### Review evidence for the exact model

A company profile is useful background, but it is not a substitute for model-level documentation. Request the specification sheet, an example inspection record and the documents relevant to your market and logistics plan. Check that the model identifiers, battery configuration and stated revision match the product you are buying. Confirm current requirements with your importer, laboratory or logistics provider rather than relying on a generic certificate image.

## Create a sample approval checklist

Agree on a written checklist before samples are shipped. Review appearance, assembly, labeling, port fit, packaging and the charging behavior for your chosen devices. Record the device, cable and adapter used so a later result can be compared fairly. Define how the supplier will respond if a sample differs from the specification.

Treat the approved sample and document revision as a reference for production. Keep photographs, measurements, agreed tolerances and packaging artwork with the purchase record. If a material, component or firmware revision changes, request a documented review before the production batch is released.

## Evaluate quality control and communication

Ask how incoming materials, production checks and finished goods inspection connect to your order. Clarify which inspection records are available, how batches are identified, and how a defect or customer complaint will be investigated. A useful discussion is specific: what is checked, against which criteria, and who approves a shipment when there is an exception?

Give equal attention to communication. Identify the commercial contact and technical contact, the expected response window and the escalation path. Clear ownership helps when packaging changes, sample feedback or shipment documents need a decision.

## Compare quotations on the same basis

Build a comparison sheet that separates the product, customization, packaging, accessories, tooling and freight assumptions. Ask for the quoted trade terms, payment milestones, validity period and the conditions that start the lead-time clock. An order with approved artwork and materials ready is different from a project awaiting design decisions.

The final choice should fit your product requirements and operating process, not just a low starting price. For an actionable quotation, use the [custom power bank RFQ checklist](/blog/custom-power-bank-supplier-rfq-checklist), then [send your project brief](/contact#quote) with the decisions and open questions clearly marked.`,
    zh: {
      title: "如何为您的品牌选择充电宝制造商",
      excerpt: "为品牌和分销商提供实用采购框架：从产品需求、样品确认到质量文件与商业条款，系统比较充电宝制造商。",
      content: `选择充电宝制造商时，建议将同一份产品需求发给候选供应商。单一报价无法说明电芯配置、充电行为、包装范围和检验标准。先明确目标客户需要什么，再比较供应商能够提供的依据。

## 报价前先定义产品需求

说明使用场景、销售渠道、目标国家、尺寸重量偏好、容量要求、接口和充电功能。将尚未决定的事项标为待确认，避免供应商按照不同假设报价。

- 产品形式：有线、磁吸或其他约定方案。
- 需要验证的目标设备与充电功能。
- 首批计划数量与后续采购范围。
- Logo、颜色、包装和配件。
- 目标市场、样品期限和上市计划。

通过[充电宝制造页面](/power-bank-manufacturer)了解项目沟通流程，并从[产品目录](/products)选择已发布型号。下单前直接确认所选型号的技术规格。

## 核实制造范围与型号资料

确认项目是现有产品贴牌、现有设计修改还是全新开发，并书面约定模具、图稿所有权和变更流程。

### 资料必须对应采购型号

公司介绍不能代替具体产品资料。索取规格书、检验记录示例以及适用于目标市场和物流方案的文件。核对型号、电池配置和版本是否与采购产品一致。由进口方、实验室或物流服务商确认实际适用要求。

## 建立样品确认清单

样品发出前约定外观、装配、标识、接口、包装及目标设备充电表现的检查项。记录测试所用设备、线材和适配器，便于后续比较。将确认样品、照片、尺寸和文件版本作为生产参考。材料、元器件或固件变更时，重新确认影响。

## 检查质量控制与沟通机制

了解来料、过程和成品检验如何关联订单，哪些记录可以提供，以及批次追溯和异常处理方式。确认商务、技术联系人与升级处理路径，减少包装修改、样品反馈和出货文件的决策延误。

## 按照统一口径比较报价

分别列出产品、定制、包装、配件、模具与运费假设。确认贸易条款、付款节点、报价有效期，以及交期从哪个事件开始计算。设计尚未确认的项目与已经批准图稿的订单不能直接比较。

最终选择应匹配产品需求和运营流程。参考[定制充电宝询价清单](/blog/custom-power-bank-supplier-rfq-checklist)，将确定事项和待确认问题整理后[提交项目需求](/contact#quote)。`,
    },
  },
  {
    slug: "magnetic-power-bank-oem-project-checklist",
    categorySlug: "oem-guides",
    title: "Magnetic Power Bank OEM: A Project Planning Checklist",
    seoTitle: "Magnetic Power Bank OEM Project Checklist | Shanze",
    metaDescription: "Plan a magnetic power bank OEM project with a buyer checklist for compatibility, industrial design, branding, samples, packaging and production approval.",
    excerpt: "Translate a magnetic power bank concept into a clear OEM brief, with device compatibility, mechanical design and sample acceptance agreed before production.",
    author: "Shanze Editorial",
    content: `A magnetic power bank OEM project combines charging requirements, a physical product experience and your brand presentation. These decisions should be reviewed together. A compact design that looks attractive in a render still needs to be evaluated with the phones, cases, cables and usage scenarios your customer expects.

## Start with the target device and use case

List the devices and cases you want to support. Specify whether the product will be used as a phone-mounted accessory, a wired backup battery, a stand or a combination of functions. Describe what you mean by a successful experience: secure positioning, access to the phone controls, a comfortable grip or another agreed requirement.

Avoid treating a magnetic attachment claim as a complete compatibility statement. Ask the supplier to identify the exact supported functions and the conditions used to verify them. Charging performance should be discussed for the selected model and test setup, rather than inferred from the product name alone.

## Define the OEM customization boundary

An OEM request can range from a printed logo on an existing model to housing, color, packaging or component changes. Clarify the baseline product, every requested change and the evidence needed to approve it. If you need a new industrial design, ask about the development process before assuming it has the same commercial terms as a branding-only order.

### Confirm artwork and physical design together

Review logo location, finish, color references, labels and packaging as one set. Artwork that fits a flat drawing may be difficult to read on a curved or textured surface. Ask for a sample or another agreed proof that represents the chosen material and printing method.

- Confirm product dimensions and the proposed artwork area.
- Check access to buttons, ports and indicators.
- Review the selected finish and how it should be inspected.
- Agree on retail packaging, instruction language and accessories.
- Identify which changes require another sample or document revision.

## Set measurable sample acceptance criteria

Use a checklist for appearance, assembly, magnetic positioning and the intended charging functions. Define the test devices and cases, the adapter and cable, the operating conditions and the observations to record. Ask the technical team to explain unexpected behavior before turning a sample into a production reference.

For any thermal, battery or protection questions, request the exact model's engineering and validation documentation. Marketing copy or a picture of a certificate should not replace the review needed for your target market. Your importer or test partner can help determine which evidence is relevant to the program.

## Prepare packaging and shipment information early

Share the packaging language, barcode plan, carton requirements and any retailer instructions during development. A late label change can require another artwork review even when the product itself is approved. Confirm the documents required by your shipment provider for the actual battery product and transport route.

Record responsibilities clearly: who approves the instruction text, who provides the barcode, who confirms the final specification, and who authorizes shipment. Keep all approved files in one revision-controlled project record.

## Move from sample approval to repeat orders

Before production, agree on the approved reference sample, inspection criteria, quantity, packaging revision and the process for deviations. After delivery, review feedback against the batch and approved specification. A repeat order should identify the same revision or explicitly document the requested changes.

Explore [magnetic power bank OEM options](/magnetic-power-bank-oem), compare [published power bank products](/products), and use our [manufacturer selection guide](/blog/how-to-choose-power-bank-manufacturer) to structure supplier discussions. When your brief is ready, [contact Shanze](/contact#quote) with the device list and customization priorities.`,
    zh: {
      title: "磁吸充电宝 OEM：项目规划清单",
      excerpt: "将磁吸充电宝构想转化为清晰的 OEM 需求，在生产前确认设备兼容性、外观设计、品牌呈现和样品验收标准。",
      content: `磁吸充电宝 OEM 同时涉及充电需求、使用体验和品牌呈现。外观图中紧凑漂亮的设计，还需要结合目标手机、保护壳、线材与使用场景进行实际确认。

## 从目标设备和使用场景开始

列出需要支持的设备与保护壳，并说明产品是手机背部配件、有线备用电池、支架或多功能组合。明确定位、握持和操作便利性等期望。磁吸连接描述不能代替完整兼容性结论，充电表现应针对具体型号和测试配置确认。

## 明确 OEM 定制范围

区分现有型号 Logo 定制、颜色包装调整、结构修改和全新设计。列出基准产品、每项变化与批准依据，新开发项目需要单独确认开发流程和商业条件。

### 图稿与实物设计同步确认

Logo 位置、表面工艺、颜色、标签与包装应作为一组审核。平面图上合适的图稿未必适用于曲面或纹理表面，应确认能够代表真实材料和工艺的样品。

- 产品尺寸和可印刷区域。
- 按键、接口与指示灯的可操作性。
- 表面工艺与外观检验方式。
- 包装、说明书语言和配件。
- 需要重新打样的设计变更。

## 制定样品验收标准

对外观、装配、磁吸定位和充电功能设定检查项，记录设备、保护壳、适配器、线材和测试条件。出现异常行为时先请技术团队解释，再决定是否批准。针对温度、电池或保护功能，索取具体型号的工程和验证资料，由进口方或测试伙伴核实目标市场所需证据。

## 提前准备包装和出货资料

开发阶段说明包装语言、条码、外箱及零售商要求。即使产品已批准，标签变化仍可能需要重新审核。由物流服务商确认实际电池产品和运输线路所需文件。记录说明书、条码、规格和出货各环节的负责人，并集中保存批准版本。

## 从样品批准衔接到复购

生产前确认参考样品、检验标准、数量、包装版本和偏差处理方式。交付后将反馈与批次及批准规格对应。复购订单需要引用相同版本，或明确记录变更。

了解[磁吸充电宝 OEM 方案](/magnetic-power-bank-oem)，比较[已发布产品](/products)，并参考[制造商选择指南](/blog/how-to-choose-power-bank-manufacturer)。准备好设备清单和定制重点后[联系我们](/contact#quote)。`,
    },
  },
  {
    slug: "wireless-charger-manufacturer-sourcing-guide",
    categorySlug: "industry-guides",
    title: "Wireless Charger Manufacturer: A B2B Sourcing Guide",
    seoTitle: "Wireless Charger Manufacturer Sourcing Guide | Shanze",
    metaDescription: "Evaluate a wireless charger manufacturer by product format, device compatibility, adapter requirements, OEM customization, samples and quality documentation.",
    excerpt: "A buyer's guide to matching a wireless charger format with the target device, accessory bundle and OEM requirements before requesting samples or a quotation.",
    author: "Shanze Editorial",
    content: `When comparing a wireless charger manufacturer, begin with the complete charging setup. The charging pad or stand is only part of the customer experience: the target device, its case, the cable, the power adapter and the position of the device all need to be considered in the project brief.

## Choose the product format for your customer

Decide whether your customer needs a desk stand, a compact pad or a multi-device station. Consider where the product will be used and how it will be packaged or displayed. A stand intended for an office desk may have different ergonomic priorities from a compact accessory intended for travel.

For multi-device designs, list every device category and the charging position assigned to it. A marketing label does not explain the compatibility of every position. Ask for model-specific information and verify the functions you need using representative devices.

## Define the accessory and compatibility requirements

Make the quoted bundle explicit. Will a cable and adapter be included, sold separately or supplied by the buyer? What plug format and packaging information does your market need? Confirm the input requirements, included accessories and conditions associated with the stated output for the selected product.

- Target phones, watches or other devices, identified by model where possible.
- Cases or accessories that will remain attached during normal use.
- The proposed adapter, cable and plug format.
- The functions to verify for each charging position.
- The indicators and user instructions needed for a clear experience.

Our [wireless charger manufacturer page](/wireless-charger-manufacturer) provides a starting point for a project discussion. Check the [published product catalog](/products) and ask our team which current models match your specific requirements.

## Ask for evidence behind product claims

Review the specification and documentation for the exact model you plan to buy. Ask the supplier to explain any standards, certification or interoperability claims and provide a way to verify the relevant documents. Do not assume a company-wide statement applies to every charger or every revision.

### Keep the model and revision aligned

Make sure the sample identifier, quotation, specification sheet, packaging and supporting documents refer to the same product configuration. If a component, housing or charging module changes, ask what needs to be rechecked and which files will be updated. Have your importer or test partner confirm the evidence needed for the destination market.

## Review OEM changes before sample approval

Logo printing, colors and packaging can be straightforward project decisions, while changes to materials, mechanical design or the charging arrangement may involve additional review. Give the manufacturer the intended visual effect and functional priorities, then ask what can be achieved with an existing model and what requires development.

Agree on an artwork proof and the sample that will represent the production order. Inspect positioning, labels, assembly, surface finish and user instructions as well as the requested charging functions. Record the test setup so differences can be investigated rather than debated from memory.

## Put inspection and commercial terms in writing

Request a clear quotation covering the product, adapter, cable, packaging, customization and any development work. Confirm quantity assumptions, trade terms, payment milestones and how the expected lead time depends on sample and artwork approval.

Before production, agree on inspection criteria and the handling of deviations. Ask which batch information and inspection records can accompany the order. A useful supplier relationship combines a suitable product with a repeatable process for approvals, delivery and technical questions.

For a structured inquiry, adapt our [custom product RFQ checklist](/blog/custom-power-bank-supplier-rfq-checklist) to your charger project and [send the requirements to Shanze](/contact#quote). If you also need portable charging products, read the [power bank manufacturer comparison guide](/blog/how-to-choose-power-bank-manufacturer).`,
    zh: {
      title: "无线充电器制造商：B2B 采购指南",
      excerpt: "从产品形态、目标设备、适配器和配件组合入手，在询价和打样前明确无线充电器的采购与 OEM 需求。",
      content: `比较无线充电器制造商时，应关注完整的充电组合。充电底座只是体验的一部分，目标设备、保护壳、线材、电源适配器和设备摆放方式，都需要纳入项目需求。

## 按客户场景选择产品形态

明确需要桌面支架、小型充电板还是多设备底座，结合使用位置、包装和陈列方式判断。多设备产品应逐项列出设备类型与对应位置，并通过具体型号资料和样品验证所需功能。

## 明确配件与兼容性要求

写明报价是否包含线材和适配器、谁负责提供，以及目标市场的插头和包装要求。确认选定型号的输入要求、附带配件和输出条件。

- 尽可能写明目标设备型号。
- 日常使用时保留的保护壳或其他附件。
- 计划使用的适配器、线材和插头。
- 每个充电位置需要确认的功能。
- 指示灯和操作说明要求。

通过[无线充电器制造页面](/wireless-charger-manufacturer)开始沟通，并从[产品目录](/products)比较已发布型号。

## 核实产品宣传依据

索取所采购型号的规格和资料。涉及标准、认证或互操作性描述时，请供应商说明并提供核验方式，不能将公司级表述自动用于所有型号。

### 保持型号与版本一致

样品标识、报价、规格书、包装和文件应对应同一配置。元器件、外壳或充电模块变化时，需要确认复核事项与更新文件。由进口方或测试伙伴核实目标市场所需资料。

## 样品批准前审核 OEM 变化

Logo、颜色和包装与结构、材料或充电布局修改的开发范围不同。说明视觉目标和功能优先级，确认现有型号能够实现哪些要求。验收时同时检查定位、标签、装配、表面工艺、说明书和充电功能，并记录完整测试配置。

## 书面确认检验和商业条款

报价应涵盖产品、适配器、线材、包装、定制和开发工作，并确认数量假设、贸易条款、付款节点及交期起算条件。生产前约定检验标准、偏差处理方式及可提供的批次与检验记录。

参考[定制产品询价清单](/blog/custom-power-bank-supplier-rfq-checklist)，整理无线充电器项目需求后[提交给 Shanze](/contact#quote)。如果同时采购便携充电产品，可阅读[充电宝制造商选择指南](/blog/how-to-choose-power-bank-manufacturer)。`,
    },
  },
  {
    slug: "custom-power-bank-supplier-rfq-checklist",
    categorySlug: "buying-guides",
    title: "Custom Power Bank Supplier: What to Include in Your RFQ",
    seoTitle: "Custom Power Bank Supplier RFQ Checklist | Shanze",
    metaDescription: "Build a clear RFQ for a custom power bank supplier: quantity, product specification, branding, packaging, target market, sample plan and quotation terms.",
    excerpt: "A ready-to-use RFQ framework that helps B2B buyers get comparable custom power bank quotations and identify the decisions still needed before sampling.",
    author: "Shanze Editorial",
    content: `A request for quotation is most useful when a custom power bank supplier can separate confirmed requirements from assumptions. A short request such as “send your best price” often produces quotations for different product configurations. A structured brief makes comparison easier and reduces repeated questions before sampling.

## Describe the business and the product goal

Introduce your company, sales channel and destination market. Explain whether the project is a branded retail product, a distributor range, a corporate gift or another program. Provide a preferred model from the [product catalog](/products) if you have one, or describe the form factor and customer use case if the product choice is still open.

State the planned first order, expected reorder pattern and launch target as planning information. Avoid presenting an uncertain forecast as a committed purchase. Ask the supplier which decisions or approvals are needed before the schedule can be confirmed.

## Separate technical requirements from preferences

List the functions your customer needs and identify the features you are flexible about. Ask for a specification sheet for the proposed model, including the battery configuration, input and output details, dimensions, weight and supported charging behavior. The exact values should be confirmed in the quotation and sample approval record.

- Required capacity or the intended usage target to discuss.
- Port arrangement and wired charging functions.
- Magnetic or wireless charging requirements, if relevant.
- Device compatibility and the sample test setup.
- Size, weight and appearance priorities.

For a magnetic project, use the [magnetic power bank OEM checklist](/blog/magnetic-power-bank-oem-project-checklist) to define the device list and mechanical experience. Keep unresolved technical questions in the RFQ so the supplier can answer them explicitly.

## Specify branding, packaging and accessories

Share a logo file and color references when available. Describe the desired logo position and finish, but allow the manufacturer to confirm what the selected model supports. List the packaging format, instruction language, barcode responsibility and accessories included with each unit.

### Request a breakdown of customization costs

Ask which costs are charged per unit and which are charged once, such as artwork setup, tooling or agreed development work. Confirm the quantity assumptions for packaging and custom components. A clear breakdown prevents a low product-only price from being compared with a quotation that includes a complete retail bundle.

## Plan samples and the approval process

Explain whether you need an existing-model evaluation sample, a branded pre-production sample or a development prototype. Request the sample cost, shipment assumptions and the approvals required before it can be made. Identify the person on your side who can approve specifications, appearance and packaging.

Use a written acceptance checklist and retain the approved file versions. If the sample requires a change, document it and ask whether another sample is necessary. The production order should reference the approved configuration rather than a series of informal messages.

## Request comparable commercial and quality information

Ask for quantity-based pricing, trade terms, payment milestones, quotation validity and the estimated schedule under stated assumptions. Include carton details and shipment information needed for freight planning. Confirm relevant documentation with your importer or logistics provider for the actual product and route.

Ask how production inspection, batch identification and defect handling will work for your order. Define what happens if a requested material or component becomes unavailable. A supplier should be able to explain the change approval process before it becomes urgent.

## Send the brief and track the open questions

A practical RFQ closes with a short list of questions: which existing model is recommended, what remains to be confirmed, which costs are excluded, and what starts the sample and production schedule? Use one version of the brief and update it as decisions are approved.

Explore our [custom power bank supplier page](/custom-power-bank-supplier) and [power bank manufacturing overview](/power-bank-manufacturer). When ready, [send Shanze your RFQ](/contact#quote) with the product type, destination market, planned quantity and customization priorities.`,
    zh: {
      title: "向定制充电宝供应商询价时应该提供什么",
      excerpt: "一份可直接参考的 B2B 询价框架，帮助采购方获得口径一致的定制充电宝报价，并提前识别打样所需决定。",
      content: `有效的询价应让定制充电宝供应商区分已确认需求与假设。只有“请发最低价”容易获得不同配置的报价，结构化需求有助于比较并减少反复沟通。

## 说明业务背景和产品目标

介绍公司、销售渠道、目标市场，以及项目是零售品牌、分销产品、企业礼品还是其他类型。可以引用[产品目录](/products)中的型号，或描述产品形态与使用场景。计划数量、复购预期和上市目标应标明确定程度，并询问确认交期所需的决定与批准。

## 区分必需功能与偏好

列出必需功能和可调整项，索取建议型号的电池、输入输出、尺寸、重量和充电功能规格。

- 容量要求或预期使用目标。
- 接口布局和有线充电功能。
- 磁吸或无线充电需求。
- 目标设备与样品测试配置。
- 尺寸、重量和外观优先级。

磁吸产品可参考[磁吸充电宝 OEM 清单](/blog/magnetic-power-bank-oem-project-checklist)。将待确认问题保留在询价中，要求供应商明确答复。

## 指定品牌、包装和配件

提供 Logo 文件、色彩参考、位置和工艺期望，由制造商确认选定型号可实现范围。说明包装形式、说明书语言、条码负责人和每台附带配件。

### 要求拆分定制费用

区分按台计费和一次性费用，例如图稿、模具或开发工作。明确包装及定制部件的数量假设，避免将仅产品价格与完整零售组合报价直接比较。

## 规划样品和批准流程

说明需要现有型号评估样品、品牌样品还是开发原型，询问费用、运输假设和制作前置批准。确定负责技术、外观与包装批准的人，使用书面验收清单并保存批准文件版本。变更应有记录，并确认是否需要重新打样。

## 索取可比较的商业与质量信息

要求阶梯价格、贸易条款、付款节点、有效期和明确假设下的计划周期。由进口方或物流服务商核实实际产品与线路所需资料。了解生产检验、批次追溯、缺陷处理与材料替换审批流程。

## 发出需求并跟踪未决事项

询价末尾列出建议型号、未确认事项、未包含费用及样品和生产交期起算条件。始终使用统一版本并随批准更新。

浏览[定制充电宝供应商页面](/custom-power-bank-supplier)和[制造流程介绍](/power-bank-manufacturer)，随后携带产品类型、市场、数量及定制重点[提交询价](/contact#quote)。`,
    },
  },
];
