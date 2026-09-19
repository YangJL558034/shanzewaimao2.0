UPDATE "Setting" SET "value"='Shanze' WHERE "key"='site_name' AND lower("value") LIKE '%enercore%';
UPDATE "Setting" SET "value"='Shanze New Energy Technology Co., Ltd.' WHERE "key"='company_name';
UPDATE "Setting" SET "value"='sales@shanzesz.com' WHERE "key"='email';
UPDATE "Setting" SET "value"='https://shanzesz.com' WHERE "key"='public_site_url';

UPDATE "SeoMeta" SET
  "title"='Power Bank Manufacturer in China | OEM/ODM Charging Solutions | Shanze',
  "description"='Shanze is a professional power bank and wireless charger manufacturer in China, providing OEM/ODM magnetic power banks, semi-solid-state power banks and custom charging solutions for global brands.',
  "canonical"='https://shanzesz.com/'
WHERE "route"='/';
UPDATE "SeoMeta" SET "canonical"='https://shanzesz.com' || "route" WHERE "canonical" LIKE '%localhost%' OR "canonical" LIKE '%127.0.0.1%';
UPDATE "SeoMeta" SET "title"=replace(replace("title",'ENERCORE','Shanze'),'Enercore','Shanze'), "description"=replace(replace("description",'ENERCORE','Shanze'),'Enercore','Shanze');

INSERT OR IGNORE INTO "SeoMeta" ("id","route","title","description","canonical","noIndex","updatedAt") VALUES
('seo-landing-power-bank','/power-bank-manufacturer','Power Bank Manufacturer in China | OEM/ODM | Shanze','Shanze manufactures magnetic and portable power banks for global B2B brands, with OEM/ODM product, branding and packaging support.','https://shanzesz.com/power-bank-manufacturer',false,CURRENT_TIMESTAMP),
('seo-landing-magnetic','/magnetic-power-bank-manufacturer','Magnetic Power Bank Manufacturer | OEM Solutions | Shanze','Source OEM magnetic power banks from Shanze for global B2B brand programs.','https://shanzesz.com/magnetic-power-bank-manufacturer',false,CURRENT_TIMESTAMP),
('seo-landing-semi-solid','/semi-solid-state-power-bank','Semi-Solid-State Power Bank OEM/ODM | Shanze','Discuss semi-solid-state power bank development with Shanze for B2B OEM/ODM projects.','https://shanzesz.com/semi-solid-state-power-bank',false,CURRENT_TIMESTAMP),
('seo-landing-oem','/power-bank-oem-odm','Power Bank OEM/ODM Services | Shanze','Shanze supports power bank OEM/ODM projects from requirements through manufacturing and packaging.','https://shanzesz.com/power-bank-oem-odm',false,CURRENT_TIMESTAMP),
('seo-landing-wireless','/wireless-charger-manufacturer','Wireless Charger Manufacturer | OEM/ODM | Shanze','Explore Shanze wireless charger manufacturing and OEM/ODM support.','https://shanzesz.com/wireless-charger-manufacturer',false,CURRENT_TIMESTAMP),
('seo-landing-custom','/custom-power-bank','Custom Power Bank Manufacturer | Shanze','Create custom power bank programs with Shanze for global B2B brands.','https://shanzesz.com/custom-power-bank',false,CURRENT_TIMESTAMP),
('seo-landing-factory','/power-bank-factory-china','Power Bank Factory in China | Shanze','Explore Shanze power bank manufacturing and quality-control support in China.','https://shanzesz.com/power-bank-factory-china',false,CURRENT_TIMESTAMP);

UPDATE "Product" SET "specifications"=json_object('Model',"sku",'Battery','10000mAh') WHERE "slug"='magnetic-power-bank-10000';
UPDATE "Product" SET "specifications"=json_object('Model',"sku",'Battery','5000mAh') WHERE "slug"='magnetic-power-bank-5000';
UPDATE "Product" SET "specifications"=json_object('Model',"sku") WHERE "slug" IN ('3-in-1-wireless-charger','magnetic-wireless-pad','travel-charging-kit','premium-gift-set');
UPDATE "Product" SET "specifications"=json_object('Model',"sku",'Battery','20000mAh','Output','PD 20W') WHERE "slug"='pd-20w-power-bank';
UPDATE "Product" SET "specifications"=json_object('Model',"sku",'Power','38W') WHERE "slug"='38w-usb-c-car-charger';
UPDATE "Product" SET "specifications"=json_object('Model',"sku",'Power','65W') WHERE "slug"='gan-65w-wall-charger';
UPDATE "Product" SET "specifications"=json_object('Model',"sku",'Power','100W') WHERE "slug"='usb-c-cable-100w';

UPDATE "News" SET "author"='Shanze Editorial', "title"=replace(replace("title",'ENERCORE','Shanze'),'Enercore','Shanze'), "excerpt"=replace(replace("excerpt",'ENERCORE','Shanze'),'Enercore','Shanze'), "content"=replace(replace("content",'ENERCORE','Shanze'),'Enercore','Shanze');
UPDATE "News" SET "status"='ARCHIVED' WHERE "slug" IN ('global-sources-showcase','community-tree-planting','factory-expansion-intelligent-line','qi2-certified-wireless-charger','next-gen-magsafe-power-bank','new-10000mah-magnetic-power-bank');
