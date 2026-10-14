export const seoLandings = {
  "magnetic-power-bank-oem": {
    title: "Magnetic Power Bank OEM | Private Label Projects | Shanze",
    description: "Plan a magnetic power bank OEM project with Shanze: define device compatibility, charging requirements, branding, packaging and sample acceptance before production.",
    h1: "Magnetic Power Bank OEM for Your Brand",
    intro: "Turn a magnetic charging concept into a defined private-label project. Compare published models, specify the devices and cases you intend to support, and agree sample tests before placing a production order.",
    focus: ["Device and case compatibility", "Charging and thermal review", "Private-label artwork", "Sample acceptance checklist"],
  },
  "custom-power-bank-supplier": {
    title: "Custom Power Bank Supplier | B2B Private Label | Shanze",
    description: "Find a custom power bank supplier for your branded range. Send Shanze a B2B RFQ covering models, quantities, artwork, packaging and delivery requirements.",
    h1: "Custom Power Bank Supplier for Branded B2B Programs",
    intro: "Prepare a comparable sourcing brief for a private-label range, distributor order or promotional project. Discuss the selected model, customization scope, sample approval and supply requirements together.",
    focus: ["RFQ and supplier comparison", "Private-label range planning", "Artwork and pack-out approval", "Order and reorder requirements"],
  },
  "power-bank-manufacturer": {
    title: "Power Bank Manufacturer in China | OEM/ODM | Shanze",
    description: "Shanze manufactures magnetic and portable power banks for global B2B brands, with OEM/ODM product, branding and packaging support.",
    h1: "Professional Power Bank Manufacturer in China",
    intro: "OEM/ODM power bank development for brands, distributors and sourcing teams, supported by product engineering, manufacturing and quality control.",
    focus: ["Magnetic power banks", "Portable power banks", "Custom branding and packaging", "B2B project support"],
  },
  "magnetic-power-bank-manufacturer": {
    title: "Magnetic Power Bank Manufacturer | OEM Solutions | Shanze",
    description: "Source OEM magnetic power banks from Shanze. Explore published models and discuss custom branding, packaging and target-market requirements.",
    h1: "Magnetic Power Bank Manufacturer for Global Brands",
    intro: "Develop magnetic power bank programs around your confirmed product requirements, visual identity, packaging and target market.",
    focus: ["Magnetic alignment", "Portable formats", "Published product models", "OEM visual customization"],
  },
  "semi-solid-state-power-bank": {
    title: "Semi-Solid-State Power Bank OEM/ODM | Shanze",
    description: "Discuss semi-solid-state power bank development with Shanze for B2B and OEM/ODM projects. Specifications are confirmed for each project before sampling.",
    h1: "Semi-Solid-State Power Bank OEM/ODM Solutions",
    intro: "A dedicated project page for brands evaluating semi-solid-state portable charging products. Technical specifications and compliance needs are confirmed project by project.",
    focus: ["Project requirement review", "Industrial design coordination", "Prototype confirmation", "Quality documentation support"],
  },
  "power-bank-oem-odm": {
    title: "Power Bank OEM/ODM Services | Product Development | Shanze",
    description: "Shanze supports power bank OEM/ODM projects from requirement review and design through sampling, manufacturing, quality control and packaging.",
    h1: "Power Bank OEM/ODM Manufacturing Services",
    intro: "A structured development path for B2B charging product programs, connecting product definition, engineering, manufacturing and delivery preparation.",
    focus: ["Requirement definition", "Sampling and validation", "Brand and packaging artwork", "Production quality control"],
  },
  "wireless-charger-manufacturer": {
    title: "Wireless Charger Manufacturer | OEM/ODM Factory | Shanze",
    description: "Explore Shanze wireless charger manufacturing and OEM/ODM support for published charging pads, stands and multi-device charging products.",
    h1: "Wireless Charger Manufacturer & OEM/ODM Partner",
    intro: "Wireless charging product support for brands and distributors, covering published models, project customization and manufacturing coordination.",
    focus: ["Charging pads", "Charging stands", "Multi-device formats", "Custom brand presentation"],
  },
  "custom-power-bank": {
    title: "Custom Power Bank Manufacturer | Private Label OEM | Shanze",
    description: "Create custom power bank programs with Shanze, including product selection, logo, color, packaging and documentation based on confirmed requirements.",
    h1: "Custom Power Bank Manufacturing for Your Brand",
    intro: "Build a branded power bank program using confirmed product options and a clear sampling process before mass production.",
    focus: ["Private label", "Color and finish options", "Retail packaging", "Project documentation"],
  },
  "power-bank-factory-china": {
    title: "Power Bank Factory in China | Manufacturing & QC | Shanze",
    description: "Learn how Shanze supports power bank manufacturing projects in China through equipment, controlled processes, testing and B2B project service.",
    h1: "Power Bank Factory in China for B2B Projects",
    intro: "Connect product development with manufacturing, process control and documented quality activities for international B2B programs.",
    focus: ["Manufacturing equipment", "Controlled production stages", "Quality inspection", "Global project communication"],
  },
} as const;

export type SeoLandingSlug = keyof typeof seoLandings;
export function isSeoLandingSlug(value: string): value is SeoLandingSlug { return Object.prototype.hasOwnProperty.call(seoLandings, value); }

export type LandingContent = {
  h1?: string;
  intro?: string;
  focus?: string[];
  overviewTitle: string;
  overview: string;
  sections: { title: string; paragraphs: string[] }[];
  checklistTitle: string;
  checklist: string[];
  faqs: { question: string; answer: string }[];
  productTerms: string[];
  related: SeoLandingSlug[];
};

export const seoLandingContent: Record<SeoLandingSlug, { en: LandingContent; zh: LandingContent }> = {
  "power-bank-manufacturer": {
    en: {
      overviewTitle: "How to choose a power bank manufacturer for your range",
      overview: "The right sourcing decision starts with a written requirement, not a capacity number alone. A retail range, a distributor program and a corporate-gift project may need different formats, packaging and acceptance tests. Use the published Shanze catalogue as a starting point, then request the specification of the actual model you plan to buy.",
      sections: [
        { title: "Define the product beyond battery capacity", paragraphs: ["Specify the intended devices, wired and wireless charging needs, ports, physical size and user environment. Ask how rated battery capacity is described and what usable output information is available under defined test conditions. Input power, cable requirements and recharge time should be reviewed with the product specification rather than assumed from the name.", "Compare portable and magnetic power banks on the same basis. The published product page provides a model reference; requested output, housing, colour or packaging changes should be confirmed in the quotation and sample documentation."] },
        { title: "Match OEM or ODM scope to the project", paragraphs: ["For an OEM enquiry, identify the existing model and branding or packaging you need. For an ODM enquiry, explain the new design or functional requirement and which specifications remain open. Development feasibility, samples, tooling scope, minimum order quantity and timing depend on the confirmed project.", "Provide a target specification and reference artwork early. An agreed sample, approved packaging files and a recorded change process make it easier to compare proposals and keep purchasing, engineering and marketing aligned."] },
        { title: "Evaluate quality and documentation before ordering", paragraphs: ["Ask which incoming, in-process and final inspection activities apply to the chosen model. Define checks for charging behaviour, connectors, appearance, packaging and identification. Review the factory and quality pages, then request evidence relevant to your order.", "For your destination market, request model-specific test reports, declarations and battery transport documents where applicable. A report for another model or a logo on a website does not establish compliance of your purchase. Agree which labels, instructions and documents will accompany the product."] },
      ],
      checklistTitle: "Power bank RFQ checklist",
      checklist: ["Product model or reference design and intended devices", "Capacity, charging outputs, inputs, ports and cable requirements", "Destination market and required compliance documents", "Order quantity, sample quantity and planned launch date", "Logo files, colour references, packaging and manual languages", "Acceptance tests, inspection requirements and delivery destination"],
      faqs: [
        { question: "How do I request a power bank manufacturing quotation?", answer: "Send the model or reference design, target market, expected quantity, charging requirements and customization brief through the enquiry form. Shanze can then discuss the available specification, samples and project terms." },
        { question: "Does Shanze support OEM and ODM power bank enquiries?", answer: "Shanze accepts OEM/ODM enquiries. Branding, packaging, design and engineering scope is reviewed for the selected model and project before a sample or production specification is confirmed." },
        { question: "What is the minimum order quantity?", answer: "Minimum order quantity depends on the product, customization and packaging. Include your expected quantity in the RFQ and request project-specific confirmation rather than assuming one quantity applies to every model." },
        { question: "Which quality documents should a buyer request?", answer: "Request the specification, relevant test reports and market or battery transport documents for the actual model. Confirm document scope, product identification and required labels with your purchasing or compliance team." },
      ], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["power-bank-oem-odm", "magnetic-power-bank-oem", "custom-power-bank-supplier"],
    },
    zh: {
      h1: "面向品牌与经销商的充电宝制造商", intro: "以明确的产品规格、确认的样品和约定的质量计划采购便携充电产品。Shanze 为品牌商、经销商和采购团队提供充电宝 OEM/ODM 项目沟通支持。", focus: ["便携充电宝选型", "OEM/ODM 项目规划", "品牌与包装协调", "型号对应的质量评估"],
      overviewTitle: "如何为您的产品线选择充电宝制造商", overview: "采购应从书面需求开始，而不只是比较容量。零售、经销和企业礼品项目对外形、包装及验收测试的要求不同。先参考 Shanze 已发布产品，再索取实际采购型号的规格与资料。",
      sections: [
        { title: "产品定义不止电池容量", paragraphs: ["明确适配设备、有线与无线充电需求、接口、尺寸及使用场景。核对额定容量的描述，并了解规定条件下的输出信息。输入功率、线材和充满时间应以具体型号资料为准。", "比较普通与磁吸充电宝时使用相同标准。输出、外壳、颜色和包装调整需在报价与样品文件中确认。"] },
        { title: "根据项目选择 OEM 或 ODM 范围", paragraphs: ["OEM 需明确现有型号及品牌、包装要求；ODM 需说明新设计、功能和待确认的规格。开发可行性、样品、模具、起订量与时间均按项目确认。", "尽早提供目标规格与图稿，记录样品、包装及变更要求，便于采购、工程和营销共同评估。"] },
        { title: "下单前评估质量与资料", paragraphs: ["了解所选型号的来料、制程和成品检验，明确充电表现、接口、外观、包装及标识的验收要求。结合工厂与质量页面索取订单相关证据。", "按目标市场索取对应型号的测试报告、声明和适用的电池运输资料。其他型号资料或网站标志不能证明采购产品符合要求，请确认随货标签、说明书与文件。"] },
      ], checklistTitle: "充电宝询价需求清单", checklist: ["型号或参考设计及适配设备", "容量、输入输出、接口与线材要求", "目标市场及所需合规资料", "订单、样品数量与上市时间", "标志、色号、包装与说明书语言", "验收、检验与收货地点"],
      faqs: [{ question: "如何索取充电宝制造报价？", answer: "通过询盘表单提交型号或参考设计、市场、数量、充电需求和定制说明，以便沟通规格、样品与项目条款。" }, { question: "可以咨询 OEM 和 ODM 项目吗？", answer: "可以。品牌、包装、外观与工程开发范围在确认样品或生产规格前按项目评估。" }, { question: "起订量是多少？", answer: "起订量与产品、定制和包装有关，请提供预计数量，由销售按项目确认。" }, { question: "需要哪些质量资料？", answer: "索取实际型号的规格、相关测试报告及市场或电池运输文件，核对范围、标识与标签要求。" }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["power-bank-oem-odm", "magnetic-power-bank-oem", "custom-power-bank-supplier"],
    },
  },
  "magnetic-power-bank-oem": {
    en: {
      overviewTitle: "Build a magnetic power bank OEM brief that can be tested", overview: "A magnetic power bank project combines battery performance, wireless charging, physical alignment and brand presentation. Treat each as a separate requirement. Attachment to a phone or case still needs a defined compatibility and charging test before you make retail claims.",
      sections: [
        { title: "Specify devices, cases and charging conditions", paragraphs: ["List the phone models and case types used by your customers. Include the intended orientation, camera clearance and any stand or grip requirements. Ask for the conditions under which charging output is specified, including the input source, ambient conditions and test device.", "Magnetic attachment is not the same as universal compatibility or a particular certification. Confirm any standard, certification or licensed marketing term against documentation for the selected model before including it on packaging or product listings."] },
        { title: "Coordinate branding with the approved specification", paragraphs: ["Start from a published model or clear development brief. Provide logo artwork, placement, colour references, finish requirements and packaging dimensions. Request confirmation of which changes are cosmetic and which affect engineering, testing or tooling.", "The approved sample should capture appearance, the product label, accessories and instructions as well as charging behaviour. Keep revision identifiers on artwork and specifications so the manufacturing brief remains consistent with the retail promise."] },
        { title: "Plan sample acceptance before the purchase order", paragraphs: ["Create a checklist covering alignment, attachment with intended cases, port and cable behaviour, charging indication, temperature observations and fit. Define test methods and acceptance criteria with your technical team rather than relying only on a brief demonstration.", "Review model-specific documents for your market and transport route. Ask about the production inspection plan and how changes from the sample are recorded. Agree quantity, sample timing, customization feasibility and required documents during the enquiry stage."] },
      ], checklistTitle: "Magnetic power bank OEM project checklist", checklist: ["Target phones, cases, camera clearance and use orientation", "Capacity, wired outputs and wireless charging requirements", "Compatibility test methods and charging test conditions", "Logo placement, colour, finish, labels and packaging files", "Sample criteria and documents for the destination market", "Quantity, accessories, packaging contents and launch date"],
      faqs: [{ question: "Can magnetic power banks be supplied with a private label?", answer: "Private-label branding and packaging can be discussed for the selected Shanze model. Available colours, finishes, logo placement and packaging options are confirmed during project review." }, { question: "Are magnetic power banks compatible with every phone and case?", answer: "Compatibility depends on the product, device and case. Provide your device list and request model-specific information and sample tests before making compatibility claims." }, { question: "Does a magnetic product automatically have Qi or other certification?", answer: "No. Magnetic attachment does not establish certification. Request the relevant model-specific documentation and confirm its scope before using certification or licensed marketing claims." }, { question: "What should I send for a magnetic power bank OEM quotation?", answer: "Send the target model, devices and cases, charging requirements, quantity, market, artwork, packaging and sample acceptance needs so the team can assess a concrete brief." }], productTerms: ["magnetic", "磁吸"], related: ["magnetic-power-bank-manufacturer", "power-bank-manufacturer", "custom-power-bank-supplier"],
    },
    zh: {
      h1: "面向品牌定制的磁吸充电宝 OEM", intro: "将磁吸充电概念转化为可评估的品牌项目。比较已发布型号，明确适配手机与保护壳，并在生产下单前约定样品测试。", focus: ["手机与保护壳适配", "充电与温升评估", "品牌定制图稿", "样品验收清单"], overviewTitle: "建立可以测试的磁吸充电宝 OEM 需求", overview: "磁吸产品涉及电池表现、无线充电、物理对位和品牌外观，应分别定义要求。能够吸附不代表已验证适配与充电性能，零售描述发布前需完成测试。",
      sections: [{ title: "明确设备、保护壳和充电条件", paragraphs: ["列出手机、保护壳、方向、摄像头避让及支架需求，核对输出测试的输入电源、环境和设备条件。", "磁吸不等于通用兼容或认证，包装中的标准、认证与授权术语需依据所选型号文件确认。"] }, { title: "让品牌定制与规格一致", paragraphs: ["提供型号或开发需求，以及标志、位置、色号、工艺和包装。确认外观变化与涉及工程、测试或模具的变化。", "确认样品涵盖外观、标签、配件、说明书和充电表现；图稿与规格保留版本编号。"] }, { title: "采购前安排样品验收", paragraphs: ["检查对位、指定保护壳附着、接口、充电指示、温度观察和尺寸适配，约定测试方法和标准。", "核对市场与运输资料，了解检验和变更记录，确认数量、样品时间与定制可行性。"] }], checklistTitle: "磁吸充电宝 OEM 项目清单", checklist: ["手机、保护壳、摄像头避让与方向", "容量、有线输出和无线需求", "适配方法与充电测试条件", "标志、颜色、工艺、标签和包装", "样品标准与目标市场资料", "数量、配件和上市计划"],
      faqs: [{ question: "磁吸充电宝可以品牌定制吗？", answer: "可以咨询所选型号的品牌与包装，颜色、工艺和位置按项目确认。" }, { question: "是否适配所有手机与保护壳？", answer: "适配取决于产品、手机和保护壳，请提供设备清单并进行样品测试。" }, { question: "磁吸是否自动具有 Qi 等认证？", answer: "不是，需索取对应型号资料并核对认证范围。" }, { question: "OEM 报价需要什么？", answer: "提供型号、设备、充电、数量、市场、图稿、包装及样品验收需求。" }], productTerms: ["magnetic", "磁吸"], related: ["magnetic-power-bank-manufacturer", "power-bank-manufacturer", "custom-power-bank-supplier"],
    },
  },
  "wireless-charger-manufacturer": {
    en: {
      overviewTitle: "Choose the wireless charger around the use case", overview: "A charging pad, desktop stand and multi-device station solve different needs. Identify the devices, how users position them and what power source is included. Compare the complete product and accessory configuration rather than judging a model by headline wattage alone.",
      sections: [
        { title: "Compare pads, stands and multi-device formats", paragraphs: ["For a pad, review placement guidance and the usable charging area. For a stand, consider supported phone orientation, viewing angle and physical fit. For a multi-device charger, list each device type and ask how simultaneous charging is specified for the model.", "Use the published catalogue to select candidate formats. Device compatibility, output, accessories and construction vary by model. Request the full specification before deciding which belongs in your retail or distribution range."] },
        { title: "Specify input power and the accessory bundle", paragraphs: ["State whether the project includes an adapter, cable or only the charger. Ask for required input characteristics and conditions needed to reach the documented charging output. Results with one adapter or device should not be treated as a guarantee for every combination.", "Discuss packaging, accessory labels, plug types and manual languages for each destination market. Agree how the bundle is represented on the sample and retail artwork so customers receive the configuration they expect."] },
        { title: "Validate compatibility and market documents", paragraphs: ["List devices, cases and placement scenarios for sample evaluation. Review charging indication, interrupted charging behaviour and temperature observations under agreed conditions. Any charging-standard or certification claim requires model-specific evidence.", "Define manufacturing inspection requirements for appearance, assembly, connectors, accessories and packaging. Request reports and declarations for your markets and verify that the documents identify the selected model. Quality planning should cover the supplied bundle, not just a generic charger reference."] },
      ], checklistTitle: "Wireless charger sourcing checklist", checklist: ["Pad, stand or multi-device format and use location", "Devices, cases and required charging orientation", "Per-device and simultaneous charging requirements", "Input specification, adapter, cable and plug configuration", "Brand artwork, packaging and market-specific instructions", "Sample criteria, quantities and model-specific documents"],
      faqs: [{ question: "Which wireless charger formats can I enquire about?", answer: "Enquire about published charging pads, stands and multi-device products in the Shanze catalogue. Specifications and customization options are confirmed for each model." }, { question: "Can I customize a wireless charger's logo and packaging?", answer: "Branding and packaging can be reviewed with the selected model. Share artwork, accessory configuration and destination-market requirements for assessment." }, { question: "Should my RFQ include the power adapter?", answer: "Yes. State whether an adapter and cable are included, along with plug type and input requirements, so the full bundle can be evaluated." }, { question: "How do I confirm wireless charging certification?", answer: "Request documentation for the actual model and check the scope of any certification or standard claim. Do not assume certification or universal compatibility from the category alone." }], productTerms: ["wireless", "charger", "无线", "充电支架", "充电板"], related: ["magnetic-power-bank-oem", "power-bank-oem-odm", "power-bank-manufacturer"],
    },
    zh: {
      h1: "面向海外 B2B 的无线充电器制造商", intro: "根据设备、使用条件和零售渠道选择无线充电产品。Shanze 支持已发布充电板、支架和多设备产品的采购及 OEM/ODM 咨询。", focus: ["无线充电板与支架", "多设备充电形式", "电源与适配器评估", "包装和使用说明"], overviewTitle: "围绕使用场景选择无线充电器", overview: "充电板、支架与多设备站解决不同需求，需明确设备、摆放和配套电源，比较完整配置而非仅标称功率。",
      sections: [{ title: "比较不同充电形式", paragraphs: ["充电板评估摆放和有效区域；支架核对方向、视角和尺寸；多设备产品需确认同时充电的规格。", "目录用于选型，适配、输出、配件与结构需按型号索取完整规格。"] }, { title: "明确输入与配件组合", paragraphs: ["说明是否包含适配器、线材或仅充电器，核对规定输出所需条件，单一组合的表现不能推及所有设备。", "按市场讨论包装、配件标签、插头和语言，样品与图稿需对应最终配置。"] }, { title: "验证适配与市场文件", paragraphs: ["制定设备、保护壳与场景清单，约定指示、充电中断和温度观察条件，认证描述需型号证据。", "生产检验覆盖装配、接口、配件和包装；核对报告与声明中的型号，并评估整套产品。"] }], checklistTitle: "无线充电器采购清单", checklist: ["产品形式与使用位置", "设备、保护壳与方向", "单设备及同时充电要求", "输入、适配器、线材和插头", "图稿、包装及说明书", "样品、数量和型号文件"],
      faqs: [{ question: "可以咨询哪些无线充电器？", answer: "参考目录中的充电板、支架与多设备产品，规格和选项按型号确认。" }, { question: "可以定制标志与包装吗？", answer: "可按型号评估，请提供图稿、配件和市场要求。" }, { question: "询价需明确适配器吗？", answer: "需要说明适配器、线材、插头和输入，以便整体评估。" }, { question: "如何确认无线充电认证？", answer: "索取实际型号的资料并核对范围，不能仅凭品类名称假设具有认证。" }], productTerms: ["wireless", "charger", "无线", "充电支架", "充电板"], related: ["magnetic-power-bank-oem", "power-bank-oem-odm", "power-bank-manufacturer"],
    },
  },
  "custom-power-bank-supplier": {
    en: {
      overviewTitle: "Compare suppliers using one sourcing brief", overview: "Quotations are comparable only when they describe the same product, branding, accessories and pack-out. For a retail line, distributor program or promotional power banks, give each supplier a consistent brief and ask for the details that affect approval, purchasing and delivery.",
      sections: [
        { title: "Make the quotation scope explicit", paragraphs: ["Identify the model or reference design, quantity and destination. Specify logo process and placement, housing colour, packaging, accessories and languages. Ask which costs or development activities are included and which need separate confirmation.", "Request project-specific minimum order quantity, sample arrangements, production timing and delivery terms. These depend on the confirmed scope; a general number from another product is not a purchasing basis for a customized order."] },
        { title: "Approve the branded product as a complete kit", paragraphs: ["Share usable artwork and a colour reference rather than a screenshot alone. Check logo position, legibility, finish, labels, inserts, barcodes and packaging layout. Record the agreed files and revisions with sample approval.", "The acceptance plan should also cover charging performance, connectors, accessories and documents for the actual model. Visual approval is only part of supplier approval. Keep the technical specification and artwork together in purchase documentation."] },
        { title: "Plan reorders and supply communication", paragraphs: ["For a repeat program, discuss SKU identification, packaging revisions, traceability and communication of changes. If several markets share one product, separate the labels, instructions and accessory bundles that differ.", "Send the launch or delivery date with your RFQ and agree what needs confirmation before production scheduling. Use the enquiry form to start a documented conversation with Shanze about the model, sample, commercial scope and inspection requirements."] },
      ], checklistTitle: "Custom power bank supplier RFQ checklist", checklist: ["Model, reference design and SKU plan", "Quantity per variant, samples and reorder expectations", "Vector logo, placement, colour and finish references", "Packaging, accessories, labels, barcodes and manuals", "Destination, delivery needs and desired commercial terms", "Technical acceptance criteria and model documents"],
      faqs: [{ question: "What should I send to a custom power bank supplier?", answer: "Send a product reference, quantity per variant, market, artwork, colour and packaging brief, accessories and delivery date. Include technical acceptance and documents so quotation scope is clear." }, { question: "Can one order include different branded variants?", answer: "Share each variant's quantity and customization needs. Feasibility, minimum quantities and packaging arrangements are reviewed for the model and order." }, { question: "Are sample timing and quantities fixed for every project?", answer: "No. Sample arrangements, minimum quantity and timing depend on the product, customization and packaging. Request written confirmation in the quotation." }, { question: "How should I prepare a repeat private-label order?", answer: "Keep approved specifications, artwork revisions, packaging and acceptance criteria with the SKU records. Confirm changes before scheduling the repeat order." }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["custom-power-bank", "power-bank-manufacturer", "power-bank-oem-odm"],
    },
    zh: {
      h1: "面向品牌项目的定制充电宝供应商", intro: "为品牌产品线、经销订单或礼品项目准备可比较的采购需求，共同确认型号、定制、样品和供货范围。", focus: ["询价与供应商比较", "品牌产品规划", "图稿与包装确认", "订单与返单需求"], overviewTitle: "以统一需求比较供应商", overview: "产品、品牌、配件和装箱范围一致时，报价才可比较。项目需提供书面要求，明确影响审批、采购和交付的内容。",
      sections: [{ title: "明确报价范围", paragraphs: ["说明型号、数量、目的地、标志、颜色、包装、配件和语言，核对包含的费用与开发项目。", "按项目索取起订量、样品、时间和交付条款，不能以其他产品的一般信息作为依据。"] }, { title: "按完整组合确认样品", paragraphs: ["提供可用图稿与颜色，核对标志、工艺、标签、内衬、条码和包装，记录文件版本。", "验收也包括充电、接口、配件和型号文件，采购记录同时保留技术规格与图稿。"] }, { title: "规划返单与沟通", paragraphs: ["讨论 SKU、版本、追溯和变更，多个市场需要区分标签、说明书与配件。", "提供上市或交付日期，明确排产前确认事项，通过表单记录商务范围和检验要求。"] }], checklistTitle: "定制充电宝供应商询价清单", checklist: ["型号、设计参考与 SKU", "各款数量、样品与返单预期", "矢量标志、位置、颜色与工艺", "包装、配件、条码和说明书", "目的地、交付与商务要求", "技术验收和型号文件"],
      faqs: [{ question: "询价需要什么资料？", answer: "提供产品、各款数量、市场、图稿、包装、配件和日期，并说明验收与文件要求。" }, { question: "可以有多个定制款式吗？", answer: "请提供各款数量与定制需求，按具体型号和订单评估。" }, { question: "样品与起订量固定吗？", answer: "不是，与型号、定制和包装有关，请在项目报价中确认。" }, { question: "返单如何准备？", answer: "按 SKU 保存规格、图稿版本、包装与验收标准，排产前核对变更。" }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["custom-power-bank", "power-bank-manufacturer", "power-bank-oem-odm"],
    },
  },
  "magnetic-power-bank-manufacturer": {
    en: {
      overviewTitle: "Compare published magnetic power bank models", overview: "Shortlist magnetic power bank formats before starting customization. Compare documented capacity, dimensions, ports and features, then ask for information not yet stated in the catalogue.",
      sections: [{ title: "Select a format for your range", paragraphs: ["An everyday accessory and a travel-oriented model may serve different buyers. Define size, weight, device fit and packaging position. Specifications and options need individual model confirmation."] }, { title: "Review fit and charging data", paragraphs: ["Request supported devices and test conditions for your shortlist. Review magnetic attachment, case clearance, output and stand features together, then evaluate samples with your customers' phones and cases."] }, { title: "Move from sourcing to an OEM brief", paragraphs: ["After selecting a candidate, use the magnetic power bank OEM guide to define artwork, compatibility testing, packaging and sample acceptance. Product selection and customization planning serve different purchasing decisions."] }], checklistTitle: "Model comparison checklist", checklist: ["Published model and dimensions", "Capacity, ports and charging specification", "Devices, cases and sample evaluation", "Accessories, packaging and model documents"], faqs: [{ question: "Where can I compare magnetic power bank models?", answer: "Review published products linked here and request the specification for your shortlist." }, { question: "How is this different from the magnetic power bank OEM page?", answer: "This page supports product comparison. The OEM guide covers customization, device testing, artwork and sample approval." }], productTerms: ["magnetic", "磁吸"], related: ["magnetic-power-bank-oem", "power-bank-manufacturer"],
    },
    zh: {
      h1: "磁吸充电宝制造商与产品选型", intro: "围绕销售渠道和目标设备选择磁吸充电宝，再核对各型号的充电规格、尺寸与文件。", focus: ["磁吸型号", "外形比较", "设备适配", "产品规格"], overviewTitle: "比较已发布磁吸型号", overview: "定制前建立候选型号清单，比较容量、尺寸、接口和功能，再索取未列出的资料。", sections: [{ title: "选择产品形式", paragraphs: ["根据日常或旅行客户明确尺寸、重量、适配和包装定位，并逐一确认选项。"] }, { title: "核对适配与充电资料", paragraphs: ["结合设备、保护壳、输出和支架功能，用目标手机评估代表性样品。"] }, { title: "由选型转入 OEM", paragraphs: ["确定型号后，参考 OEM 指南制定图稿、测试、包装和验收需求。"] }], checklistTitle: "型号比较清单", checklist: ["型号与尺寸", "容量、接口与输出", "设备、保护壳与样品", "配件、包装和文件"], faqs: [{ question: "如何比较型号？", answer: "参考本页产品并索取具体规格。" }, { question: "与 OEM 页面有何区别？", answer: "本页侧重选型，OEM 页面侧重定制、测试与样品确认。" }], productTerms: ["magnetic", "磁吸"], related: ["magnetic-power-bank-oem", "power-bank-manufacturer"],
    },
  },
  "semi-solid-state-power-bank": {
    en: {
      overviewTitle: "Evaluate cell technology with product-specific evidence", overview: "Semi-solid-state terminology alone does not define finished-product performance. Review the actual cell specification, construction and test evidence before comparing portable charging technologies.", sections: [{ title: "Request cell and product specifications", paragraphs: ["Define capacity, dimensions, charging needs and use environment. Request the proposed cell information and its identification in product documents. Availability and development feasibility are reviewed for the project."] }, { title: "Distinguish results from assumptions", paragraphs: ["Check model identifiers and test conditions. Do not infer temperature behaviour, life expectancy or comparative safety from a technology name. Agree evaluation methods and criteria for your product."] }, { title: "Plan staged development", paragraphs: ["Provide market, quantity, timing and documentation needs. Confirm specifications and sample evaluation before production commitment. Engineering projects need a defined scope and milestones."] }], checklistTitle: "Technology enquiry checklist", checklist: ["Cell and product specifications", "Use environment and charging needs", "Model-specific evidence and acceptance criteria", "Market, quantity and development milestones"], faqs: [{ question: "Does the technology name prove performance?", answer: "No. Performance and comparative claims need evidence for the actual cell and product under defined conditions." }, { question: "How do I enquire about development?", answer: "Send intended use, capacity, dimensions, charging needs, market and evaluation requirements for a feasibility review." }], productTerms: ["semi-solid", "solid-state", "半固态"], related: ["power-bank-oem-odm", "power-bank-manufacturer"],
    },
    zh: {
      h1: "半固态充电宝 OEM/ODM 项目", intro: "技术规格与市场要求需按具体项目确认。", focus: ["需求评估", "电芯文件", "样品验证", "型号质量计划"], overviewTitle: "用实际证据评估电芯技术", overview: "半固态名称不能定义成品表现，需要实际电芯、结构与对应测试证据。", sections: [{ title: "索取电芯与成品规格", paragraphs: ["明确容量、尺寸、充电和环境，核对技术信息与产品标识。"] }, { title: "区分结果与假设", paragraphs: ["核对型号与测试条件，不能仅凭名称推断温度、寿命或相对安全。"] }, { title: "分阶段开发", paragraphs: ["提供市场、数量、时间和文件需求，在生产前完成样品评价。"] }], checklistTitle: "技术评估需求", checklist: ["电芯与成品资料", "环境和充电", "测试证据与标准", "市场和节点"], faqs: [{ question: "名称能证明表现吗？", answer: "不能，需对应电芯与产品在规定条件下的证据。" }, { question: "如何咨询开发？", answer: "提供用途、容量、尺寸、充电、市场与评估需求。" }], productTerms: ["semi-solid", "solid-state", "半固态"], related: ["power-bank-oem-odm", "power-bank-manufacturer"],
    },
  },
  "power-bank-oem-odm": {
    en: {
      overviewTitle: "Define development scope before sampling", overview: "An existing-model branding project starts with a product and artwork; a new-design enquiry needs functional requirements and a feasibility plan. Confirm the scope before comparing proposals.", sections: [{ title: "OEM starts with the selected model", paragraphs: ["Record model, logo, finish, packaging, accessories and market documents. Identify electrical or construction changes separately from cosmetic customization."] }, { title: "ODM starts with the requirement", paragraphs: ["Describe users, devices, dimensions, charging and markets. Reference designs give context but do not replace requirements. Ask which design, engineering, tooling and testing tasks are included."] }, { title: "Set sample and production decision points", paragraphs: ["Agree what each sample stage demonstrates and who approves it. Record specification changes, artwork revisions and acceptance criteria. Production should reference the approved sample and documents."] }], checklistTitle: "OEM/ODM development brief", checklist: ["Existing model or new-design scope", "Function, devices, dimensions and use", "Artwork, tooling and engineering needs", "Sample milestones, acceptance and market files"], faqs: [{ question: "How do I distinguish OEM and ODM?", answer: "For OEM, identify the existing model and customization. For ODM, describe new design or functions for feasibility and scope assessment." }, { question: "When is production specification confirmed?", answer: "Record the approved sample, final specification, artwork and inspection requirements before production planning." }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["magnetic-power-bank-oem", "custom-power-bank", "power-bank-factory-china"],
    },
    zh: {
      h1: "充电宝 OEM/ODM 制造服务", intro: "连接需求、工程、样品、制造和交付资料，建立清晰项目流程。", focus: ["需求定义", "样品验证", "品牌图稿", "质量规划"], overviewTitle: "样品前明确开发范围", overview: "现有型号品牌项目从型号和图稿开始，新设计需要功能和可行性评估。", sections: [{ title: "OEM 明确所选型号", paragraphs: ["记录标志、工艺、包装、配件与文件，电气或结构变化单独评估。"] }, { title: "ODM 明确功能需求", paragraphs: ["说明用户、设备、尺寸、充电与市场，核对设计、工程、模具和测试范围。"] }, { title: "设置确认节点", paragraphs: ["约定样品目的与审批，记录变更、图稿和标准，生产引用确认资料。"] }], checklistTitle: "OEM/ODM 开发需求", checklist: ["型号或新设计", "功能与场景", "图稿、模具与工程", "样品与验收节点"], faqs: [{ question: "如何区分 OEM 和 ODM？", answer: "OEM 说明型号与定制；ODM 提供新设计或功能需求。" }, { question: "何时确认规格？", answer: "排产前记录样品、规格、图稿和检验要求。" }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["magnetic-power-bank-oem", "custom-power-bank", "power-bank-factory-china"],
    },
  },
  "custom-power-bank": {
    en: {
      overviewTitle: "Turn brand artwork into an approved product", overview: "A custom power bank expresses your brand while retaining a clear technical specification. This page focuses on appearance and packaging; the supplier guide covers quotation scope, quantities and reorders.", sections: [{ title: "Prepare a usable brand brief", paragraphs: ["Provide vector logos, colour references, placement and finish examples. Identify essential and adaptable details. Available processes and colours need model-specific confirmation."] }, { title: "Design packaging around actual contents", paragraphs: ["Specify products, cables, inserts, display needs and manual languages. Review dimensions, identification and artwork with the proposed pack-out."] }, { title: "Approve revisions with the sample", paragraphs: ["Check final artwork against the sample and record adjustments. Keep technical, visual and packaging approvals together so cosmetic changes are not confused with functional ones."] }], checklistTitle: "Brand design checklist", checklist: ["Vector logo and colour references", "Placement, finish and model constraints", "Packaging contents and manuals", "Approved artwork and sample revision"], faqs: [{ question: "What artwork is needed?", answer: "Provide usable logos, colours, placement and packaging artwork or a clear brief for review against the chosen model." }, { question: "Where is the supplier RFQ checklist?", answer: "The custom power bank supplier guide covers quantities, destination, quotation scope, acceptance and repeat orders." }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["custom-power-bank-supplier", "power-bank-oem-odm"],
    },
    zh: {
      h1: "面向品牌的定制充电宝", intro: "根据确认的选项与样品规划品牌产品。", focus: ["外观需求", "标志工艺", "零售包装", "图稿确认"], overviewTitle: "从图稿到确认产品", overview: "本页侧重外观与包装，供应商指南涵盖报价和返单。", sections: [{ title: "准备品牌资料", paragraphs: ["提供矢量标志、色号、位置与工艺参考，按型号确认选项。"] }, { title: "按内容设计包装", paragraphs: ["明确产品、配件、内衬、陈列和语言，核对标识与版面。"] }, { title: "结合样品确认", paragraphs: ["记录最终图稿、样品调整和技术规格。"] }], checklistTitle: "设计清单", checklist: ["标志与颜色", "位置和工艺", "包装和语言", "图稿与样品版本"], faqs: [{ question: "需要什么图稿？", answer: "提供可用标志、颜色、位置和包装需求。" }, { question: "哪里查看询价清单？", answer: "定制充电宝供应商指南包含采购需求。" }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["custom-power-bank-supplier", "power-bank-oem-odm"],
    },
  },
  "power-bank-factory-china": {
    en: {
      overviewTitle: "Prepare a focused factory and production review", overview: "A factory review is useful when tied to your intended product. Start with the published factory and quality pages, then ask how the model moves through manufacturing and which records apply to your order.", sections: [{ title: "Map the production stages", paragraphs: ["Discuss assembly, material identification and checks for the product. Confirm sample approvals and how production changes are communicated."] }, { title: "Agree the inspection scope", paragraphs: ["Define incoming, process and final checks. Include functions, appearance, packaging, labels and accessories. General factory images do not replace evidence for the model."] }, { title: "Connect quality and delivery", paragraphs: ["Agree the inspection records and documents accompanying the order. Confirm packaging, traceability and applicable destination-market or battery transport paperwork."] }], checklistTitle: "Factory review checklist", checklist: ["Production flow for the model", "Material identification and changes", "Inspection methods and criteria", "Packaging, traceability and order files"], faqs: [{ question: "Where can I review factory information?", answer: "The factory page introduces published equipment and manufacturing content to frame model-specific questions." }, { question: "Which inspection needs should I define?", answer: "Specify functional, appearance, packaging, accessory and identification checks, acceptance criteria and required model documents." }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["power-bank-manufacturer", "power-bank-oem-odm"],
    },
    zh: {
      h1: "面向 B2B 项目的中国充电宝工厂", intro: "连接产品开发、制造、过程控制和质量记录。", focus: ["制造设备", "生产评估", "检验节点", "项目资料"], overviewTitle: "围绕型号评估工厂", overview: "参考已发布工厂与质量内容，再核对具体型号流程和订单记录。", sections: [{ title: "了解生产阶段", paragraphs: ["讨论装配、物料、检验与变更沟通。"] }, { title: "约定检验范围", paragraphs: ["定义来料、制程与成品检查，一般图片不能代替型号证据。"] }, { title: "连接质量与交付", paragraphs: ["确认包装、追溯、随货文件和运输资料。"] }], checklistTitle: "工厂评估清单", checklist: ["型号制造流程", "物料与变更记录", "检验与验收", "包装和文件"], faqs: [{ question: "哪里查看工厂资料？", answer: "工厂页面提供已发布设备和制造信息。" }, { question: "应明确哪些检验？", answer: "功能、外观、包装、配件和标识，以及验收与文件要求。" }], productTerms: ["power bank", "powerbank", "充电宝", "移动电源"], related: ["power-bank-manufacturer", "power-bank-oem-odm"],
    },
  },
};
