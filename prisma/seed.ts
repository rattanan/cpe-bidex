import { ActivityType, LeadSource, LeadStatus, LeadTemperature, PrismaClient, ProspectHeatLevel, ProspectSource, ProspectStatus, Role } from "@prisma/client";
import { hash } from "bcryptjs";

import { NAVIGATION_PERMISSIONS, QUICK_CREATE_PERMISSIONS } from "../lib/authorization/navigation-permissions";
import { CPE_ROLE_GRANTS } from "../lib/cpe/config";
import { DASHBOARD_PERMISSIONS } from "../lib/dashboard/dashboard-permissions";
import { THAI_DISTRICTS } from "../lib/customer/district-reference-data";
import { THAI_PROVINCES } from "../lib/customer/province-reference";
import { PRODUCT } from "../lib/company-profile";

const prisma = new PrismaClient();

async function main() {
  for (const [roleCode, codes] of Object.entries(CPE_ROLE_GRANTS)) for (const permissionCode of codes) {
    await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  }
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const demoMode = process.env.SEED_DEMO_DATA === "1";
  let admin;
  if (email && password) {
    admin = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN },
      create: { email, name: `ผู้ดูแลระบบ ${PRODUCT.shortName}`, passwordHash: await hash(password, 12), role: Role.ADMIN },
    });
  } else if (demoMode) {
    admin = await prisma.user.findFirst({ where: { role: Role.ADMIN, active: true }, orderBy: { createdAt: "asc" } });
    if (!admin) throw new Error("No active ADMIN exists; set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD.");
  } else {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.");
  }
  const categoryNames:Record<string,string>={BROADBAND:"Broadband",DATACOM:"Datacom",HARD_INFRASTRUCTURE:"Hard Infrastructure",INTERNATIONAL:"International",SATELLITE:"Satellite",VOICE:"Voice"};
  let categoryOrder=0;
  for(const[code,name]of Object.entries(categoryNames)){await prisma.serviceCategoryConfig.upsert({where:{code},update:{},create:{code,name,requiresSiteSurvey:false,requiresBoq:false,requiresPhysicalInstallation:false,displayOrder:categoryOrder}});categoryOrder+=10;}
  const solutionReferenceSeeds:Record<string,readonly (readonly [string,string])[]>={
    SOLUTION_CATEGORY:[["NETWORK","Network & Connectivity"],["CLOUD","Cloud"],["CYBERSECURITY","Cybersecurity"],["DATA_CENTER","Data Center"],["MANAGED_SERVICE","Managed Service"],["UNIFIED_COMMUNICATIONS","Unified Communications"],["IOT","IoT"],["DATA_AI","Data & AI"],["OTHER","Other"]],
    COMPONENT_TYPE:[["CIRCUIT","Circuit / Link"],["ROUTER","Router"],["SWITCH","Switch"],["FIREWALL","Firewall"],["ACCESS_POINT","Wireless Access Point"],["SERVER","Server"],["STORAGE","Storage"],["SOFTWARE","Software"],["LICENSE","License"],["MANAGED_SERVICE","Managed Service"],["OTHER","Other"]],
    RISK_CATEGORY:[["TECHNICAL","Technical"],["DELIVERY","Delivery"],["SECURITY","Security"],["COMMERCIAL","Commercial"],["DEPENDENCY","Dependency"],["SITE","Site"],["COMPLIANCE","Compliance"],["OTHER","Other"]],
    RISK_PROBABILITY:[["LOW","Low"],["MEDIUM","Medium"],["HIGH","High"]],
    RISK_IMPACT:[["LOW","Low"],["MEDIUM","Medium"],["HIGH","High"],["CRITICAL","Critical"]],
    RISK_SEVERITY:[["LOW","Low"],["MEDIUM","Medium"],["HIGH","High"],["CRITICAL","Critical"]],
  };
  for(const[groupCode,options]of Object.entries(solutionReferenceSeeds))for(const[index,[code,name]]of options.entries())await prisma.solutionReferenceOption.upsert({where:{groupCode_code:{groupCode,code}},update:{name,active:true,displayOrder:(index+1)*10},create:{groupCode,code,name,displayOrder:(index+1)*10}});
  const boqSections=["NETWORK_EQUIPMENT","CUSTOMER_PREMISE_EQUIPMENT","FIBER_CABLE","ACCESSORIES","RACK_POWER","CIVIL_WORK","INSTALLATION_LABOR","CONFIGURATION","TESTING_COMMISSIONING","PROFESSIONAL_SERVICE","PROJECT_MANAGEMENT","DOCUMENTATION","TRAINING","ONE_TIME_SERVICE_CHARGE","MONTHLY_RECURRING_CHARGE","ANNUAL_RECURRING_CHARGE","OTHER"];
  for(const[displayOrder,code]of boqSections.entries())await prisma.boqSection.upsert({where:{code},update:{name:code.split("_").map(v=>v[0]+v.slice(1).toLowerCase()).join(" "),active:true,displayOrder},create:{code,name:code.split("_").map(v=>v[0]+v.slice(1).toLowerCase()).join(" "),displayOrder}});
  const solutionStatuses=["DRAFT","REQUIREMENTS_REVIEW","SITE_SURVEY_REQUIRED","SITE_SURVEY_REQUESTED","SITE_SURVEY_SCHEDULED","SITE_SURVEY_IN_PROGRESS","SITE_SURVEY_COMPLETED","SOLUTION_IN_DESIGN","BOQ_PREPARATION","TECHNICAL_REVIEW","COMMERCIAL_REVIEW","REVISION_REQUIRED","APPROVED","REJECTED","CANCELLED","SUPERSEDED"];
  const solutionRequired:Record<string,string[]>={REQUIREMENTS_REVIEW:["opportunityId","solutionDesignName","salesOwnerId","preSalesOwnerId","customerRequirements","services"],SITE_SURVEY_REQUIRED:["sites"],SITE_SURVEY_REQUESTED:["sites"],SOLUTION_IN_DESIGN:["approvedSurvey"],BOQ_PREPARATION:["components"],TECHNICAL_REVIEW:["boq"],APPROVED:["boq"]};
  for(const[displayOrder,code]of solutionStatuses.entries())await prisma.solutionStatusDefinition.upsert({where:{entityType_code:{entityType:"SOLUTION_DESIGN",code}},update:{name:code.replaceAll("_"," "),displayOrder,requiredFields:solutionRequired[code]??[],active:true,closed:["APPROVED","REJECTED","CANCELLED","SUPERSEDED"].includes(code)},create:{entityType:"SOLUTION_DESIGN",code,name:code.replaceAll("_"," "),displayOrder,requiredFields:solutionRequired[code]??[],requiredChecklistItems:[],requiredApprovals:[],closed:["APPROVED","REJECTED","CANCELLED","SUPERSEDED"].includes(code)}});
  const surveyStatuses=["DRAFT","PENDING_INFORMATION","READY_TO_SUBMIT","SUBMITTED","ACKNOWLEDGED","ASSIGNED","SCHEDULED","IN_PROGRESS","COMPLETED","RESULT_SUBMITTED","RESULT_UNDER_REVIEW","RESULT_APPROVED","RETURNED_FOR_REVISION","CANCELLED","FAILED_INTEGRATION"];
  for(const[displayOrder,code]of surveyStatuses.entries())await prisma.solutionStatusDefinition.upsert({where:{entityType_code:{entityType:"SITE_SURVEY",code}},update:{name:code.replaceAll("_"," "),displayOrder,requiredFields:[],active:true,closed:["RESULT_APPROVED","CANCELLED"].includes(code)},create:{entityType:"SITE_SURVEY",code,name:code.replaceAll("_"," "),displayOrder,requiredFields:[],requiredChecklistItems:[],requiredApprovals:[],closed:["RESULT_APPROVED","CANCELLED"].includes(code)}});
  const boqStatuses=["DRAFT","IN_PREPARATION","PENDING_TECHNICAL_REVIEW","PENDING_COMMERCIAL_REVIEW","REVISION_REQUIRED","APPROVED","REJECTED","SUPERSEDED","CANCELLED"];
  for(const[displayOrder,code]of boqStatuses.entries())await prisma.solutionStatusDefinition.upsert({where:{entityType_code:{entityType:"BOQ",code}},update:{name:code.replaceAll("_"," "),displayOrder,requiredFields:[],active:true,closed:["APPROVED","REJECTED","SUPERSEDED","CANCELLED"].includes(code)},create:{entityType:"BOQ",code,name:code.replaceAll("_"," "),displayOrder,requiredFields:[],requiredChecklistItems:[],requiredApprovals:[],closed:["APPROVED","REJECTED","SUPERSEDED","CANCELLED"].includes(code)}});
  const solutionTransitions=[["DRAFT","REQUIREMENTS_REVIEW"],["REQUIREMENTS_REVIEW","SITE_SURVEY_REQUIRED"],["REQUIREMENTS_REVIEW","SOLUTION_IN_DESIGN"],["SITE_SURVEY_REQUIRED","SITE_SURVEY_REQUESTED"],["SITE_SURVEY_COMPLETED","SOLUTION_IN_DESIGN"],["SOLUTION_IN_DESIGN","BOQ_PREPARATION"],["BOQ_PREPARATION","TECHNICAL_REVIEW"],["TECHNICAL_REVIEW","COMMERCIAL_REVIEW"],["COMMERCIAL_REVIEW","APPROVED"],["TECHNICAL_REVIEW","REVISION_REQUIRED"],["COMMERCIAL_REVIEW","REVISION_REQUIRED"],["TECHNICAL_REVIEW","REJECTED"],["COMMERCIAL_REVIEW","REJECTED"],["REVISION_REQUIRED","SOLUTION_IN_DESIGN"]];
  const surveyTransitions=[["DRAFT","READY_TO_SUBMIT"],["DRAFT","SUBMITTED"],["READY_TO_SUBMIT","SUBMITTED"],["SUBMITTED","ASSIGNED"],["ASSIGNED","SCHEDULED"],["SCHEDULED","IN_PROGRESS"],["IN_PROGRESS","RESULT_SUBMITTED"],["RESULT_SUBMITTED","RESULT_APPROVED"],["RESULT_SUBMITTED","RETURNED_FOR_REVISION"],["RESULT_SUBMITTED","CANCELLED"],["RETURNED_FOR_REVISION","IN_PROGRESS"],["RETURNED_FOR_REVISION","RESULT_SUBMITTED"]];
  const boqTransitions=[["DRAFT","IN_PREPARATION"],["DRAFT","PENDING_TECHNICAL_REVIEW"],["IN_PREPARATION","PENDING_TECHNICAL_REVIEW"],["PENDING_TECHNICAL_REVIEW","PENDING_COMMERCIAL_REVIEW"],["PENDING_TECHNICAL_REVIEW","REVISION_REQUIRED"],["PENDING_COMMERCIAL_REVIEW","APPROVED"],["PENDING_COMMERCIAL_REVIEW","REVISION_REQUIRED"],["PENDING_TECHNICAL_REVIEW","REJECTED"],["PENDING_COMMERCIAL_REVIEW","REJECTED"],["REVISION_REQUIRED","PENDING_TECHNICAL_REVIEW"]];
  for(const[entityType,transitions]of [["SOLUTION_DESIGN",solutionTransitions],["SITE_SURVEY",surveyTransitions],["BOQ",boqTransitions]] as const)for(const[fromStatusCode,toStatusCode]of transitions)await prisma.solutionStatusTransition.upsert({where:{entityType_fromStatusCode_toStatusCode:{entityType,fromStatusCode,toStatusCode}},update:{active:true},create:{entityType,fromStatusCode,toStatusCode}});
  await prisma.opportunityTransitionPolicyVersion.upsert({where:{policyCode_version:{policyCode:"SOLUTION_PROPOSAL",version:2}},update:{},create:{id:"otp_solution_proposal_v2",policyCode:"SOLUTION_PROPOSAL",version:2,command:"FORWARD",fromStage:"SOLUTION",toStage:"PROPOSAL",requiredFields:["coverageConfirmed","solutionComplete"],requiredPermission:"opportunity.transition",active:true,effectiveFrom:new Date("2026-08-26T07:00:00.000Z")}});
  const presalesPermissionMatrix:Record<string,string[]>={ADMIN:["solution-design.view","solution-design.manage","solution-design.submit","solution-design.technical.approve","solution-design.commercial.approve","site-survey.view","site-survey.request","site-survey.coordinate","site-survey.perform","site-survey.result.approve","boq.view","boq.manage","boq.cost.view","boq.approve"],SALES_DIRECTOR:["solution-design.view","site-survey.view","boq.view"],TEAM_MANAGER:["solution-design.view","site-survey.view","boq.view"],KAM:["solution-design.view","solution-design.manage","site-survey.view","site-survey.request","boq.view"],PRESALES:["solution-design.view","solution-design.manage","solution-design.submit","site-survey.view","site-survey.request","site-survey.perform","boq.view","boq.manage","boq.cost.view"],SOLUTION_ARCHITECT:["solution-design.view","solution-design.manage","solution-design.submit","solution-design.technical.approve","site-survey.view","site-survey.coordinate","site-survey.result.approve","boq.view","boq.manage","boq.cost.view"],COVERAGE:["solution-design.view","site-survey.view","site-survey.coordinate","site-survey.perform","boq.view"],PRICING_APPROVER:["solution-design.view","solution-design.commercial.approve","boq.view","boq.cost.view","boq.approve"],AUDITOR:["solution-design.view","site-survey.view","boq.view"]};
  const catalogPermissionMatrix:Record<string,string[]>={ADMIN:["product.catalog.view","product.catalog.manage","coverage.view","coverage.manage"],KAM:["product.catalog.view","coverage.view","coverage.manage"],PRESALES:["product.catalog.view","coverage.view","coverage.manage"],SOLUTION_ARCHITECT:["product.catalog.view","coverage.view","coverage.manage"],COVERAGE:["product.catalog.view","coverage.view","coverage.manage"],PRICING_APPROVER:["product.catalog.view","coverage.view"],VIEWER:["product.catalog.view","coverage.view"]};
  for(const[roleCode,codes]of Object.entries(catalogPermissionMatrix))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  for(const[roleCode,codes]of Object.entries(presalesPermissionMatrix))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const proposalApprovalPermissions:Record<string,string[]>={ADMIN:["proposal.review.manager","proposal.approve.director"],TEAM_MANAGER:["proposal.review.manager"],SALES_DIRECTOR:["proposal.approve.director"]};
  for(const[roleCode,codes]of Object.entries(proposalApprovalPermissions))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  await prisma.approvalSystemConfiguration.upsert({where:{id:"approval_system"},update:{},create:{id:"approval_system",mode:"DISABLED",reason:"Approval conditions are not yet approved; draft creation remains available."}});
  const approvalWorkflows=[
    ["approval_workflow_quote","QUOTE_APPROVAL","Quotation Approval","COMMERCIAL","QuoteVersion.total","approval_quote",10],
    ["approval_workflow_proposal","PROPOSAL_APPROVAL","Proposal Approval","PROPOSAL",null,"approval_proposal",20],
    ["approval_workflow_solution_technical","SOLUTION_TECHNICAL_REVIEW","Solution Technical Review","PRESALES",null,"approval_solution_technical",30],
    ["approval_workflow_solution_commercial","SOLUTION_COMMERCIAL_APPROVAL","Solution Commercial Approval","PRESALES","SolutionDesign.estimatedPrice","approval_solution_commercial",40],
    ["approval_workflow_site_survey","SITE_SURVEY_RESULT_APPROVAL","Site Survey Result Approval","PRESALES",null,"approval_site_survey",50],
    ["approval_workflow_boq","BOQ_APPROVAL","BOQ Approval","PRESALES","BoqHeader.totalContractValue","approval_boq",60],
    ["approval_workflow_contract","CONTRACT_APPROVAL","Contract Approval","CONTRACT","Contract.totalContractValue","approval_contract",70],
  ] as const;
  for(const[id,code,name,moduleCode,amountSource,policyId,displayOrder]of approvalWorkflows){const policy=await prisma.approvalPolicy.upsert({where:{code},update:{},create:{id:policyId,code}});await prisma.approvalWorkflowConfiguration.upsert({where:{code},update:{name,moduleCode,amountSource,displayOrder},create:{id,code,name,moduleCode,amountSource,policyId:policy.id,displayOrder,mode:"DISABLED",reason:"Temporarily disabled pending approved conditions."}});}
  const proposalSections = [
    ["EXECUTIVE_SUMMARY","Executive Summary"],["CUSTOMER_CHALLENGES","Customer Challenges"],["BUSINESS_OBJECTIVES","Business Objectives"],["PROPOSED_SOLUTION","Proposed Solution"],["SOLUTION_BENEFITS","Solution Benefits"],["IMPLEMENTATION_PLAN","Implementation Plan"],["TIMELINE","Timeline"],["PROJECT_SCOPE","Project Scope"],["DELIVERABLES","Deliverables"],["ASSUMPTIONS","Assumptions"],["SUPPORT","Support"],["PRICING_SUMMARY","Pricing Summary"],["TERMS_AND_CONDITIONS","Terms & Conditions"],["NEXT_STEPS","Next Steps"],
  ] as const;
  const proposalTemplates = [["BROADBAND","Broadband"],["INTERNET_LEASE_LINE","Internet Lease Line"],["MPLS","MPLS"],["CLOUD","Cloud"],["MANAGED_SERVICE","Managed Service"],["CYBER_SECURITY","Cyber Security"],["DATA_CENTER","Data Center"],["AI_SOLUTION","AI Solution"],["IOT","IoT"]] as const;
  for (const [code,name] of proposalTemplates) {
    const template=await prisma.proposalTemplate.upsert({where:{code},update:{name,category:code,active:true},create:{code,name,category:code,createdById:admin.id}});
    let version=await prisma.proposalTemplateVersion.findUnique({where:{templateId_version:{templateId:template.id,version:1}}});
    if(!version)version=await prisma.proposalTemplateVersion.create({data:{templateId:template.id,version:1,createdById:admin.id,terms:"Commercial and legal terms require authorized review before sending.",footer:"NT Enterprise Sales",sections:{create:proposalSections.map(([sectionCode,title],sortOrder)=>({sectionCode,title,sortOrder,defaultContent:"",contentType:"RICH_TEXT"}))}}});
    if(template.activeVersionId!==version.id)await prisma.proposalTemplate.update({where:{id:template.id},data:{activeVersionId:version.id}});
  }
  const contractTypes = [["INTERNET_SERVICE","Internet Service"],["LEASED_LINE","Leased Line"],["MPLS","MPLS"],["CLOUD","Cloud"],["MANAGED_SERVICE","Managed Service"],["CYBER_SECURITY","Cyber Security"],["DATA_CENTER","Data Center"],["AI_SOLUTION","AI Solution"],["IOT","IoT"],["MASTER_SERVICE_AGREEMENT","Master Service Agreement"],["STATEMENT_OF_WORK","Statement of Work"],["MAINTENANCE","Maintenance"],["OTHER","Other"]] as const;
  for(const[code,name]of contractTypes)await prisma.contractTypeDefinition.upsert({where:{code},update:{name,active:true},create:{code,name}});
  const contractStatuses = [["DRAFT","Draft","OPEN",false],["INTERNAL_REVIEW","Internal Review","REVIEW",false],["LEGAL_REVIEW","Legal Review","REVIEW",false],["CUSTOMER_REVIEW","Customer Review","REVIEW",false],["REVISION_REQUIRED","Revision Required","OPEN",false],["PENDING_APPROVAL","Pending Approval","APPROVAL",false],["CUSTOMER_SIGN_PENDING","Customer Signature Pending","SIGNATURE",false],["NT_SIGN_PENDING","NT Signature Pending","SIGNATURE",false],["EFFECTIVE","Effective","ACTIVE",false],["READY_FOR_SERVICE_ORDER","Ready for Service Order","ACTIVE",false],["COMPLETED","Completed","CLOSED",true],["CANCELLED","Cancelled","CLOSED",true],["EXPIRED","Expired","CLOSED",true]] as const;
  for(const[sortOrder,[code,label,reportingCategory,terminal]]of contractStatuses.entries())await prisma.contractStatusDefinition.upsert({where:{code},update:{label,sortOrder,reportingCategory,terminal,active:true},create:{code,label,sortOrder,reportingCategory,terminal}});
  const contractTransitions = [["DRAFT","INTERNAL_REVIEW",null,false,[]],["INTERNAL_REVIEW","LEGAL_REVIEW","contract.review.manager",true,[]],["LEGAL_REVIEW","CUSTOMER_REVIEW","contract.review.legal",true,[]],["CUSTOMER_REVIEW","REVISION_REQUIRED","contract.manage",false,[]],["REVISION_REQUIRED","INTERNAL_REVIEW","contract.manage",false,[]],["CUSTOMER_REVIEW","PENDING_APPROVAL","contract.review.manager",true,[]],["PENDING_APPROVAL","CUSTOMER_SIGN_PENDING","contract.approve",true,[]],["CUSTOMER_SIGN_PENDING","NT_SIGN_PENDING","contract.signature.manage",false,["CUSTOMER"]],["NT_SIGN_PENDING","EFFECTIVE","contract.signature.manage",true,["CUSTOMER","NT"]],["EFFECTIVE","READY_FOR_SERVICE_ORDER","contract.service-order.create",false,["CUSTOMER","NT"]],["READY_FOR_SERVICE_ORDER","COMPLETED","contract.manage",true,[]]] as const;
  for(const[fromStatusCode,toStatusCode,requiredPermission,makerChecker,requiredSignatureParties]of contractTransitions)await prisma.contractStatusTransition.upsert({where:{fromStatusCode_toStatusCode:{fromStatusCode,toStatusCode}},update:{requiredPermission,makerChecker,requiredSignatureParties:[...requiredSignatureParties],active:true},create:{fromStatusCode,toStatusCode,requiredPermission,makerChecker,requiredSignatureParties:[...requiredSignatureParties]}});
  const contractPermissionMatrix:Record<string,string[]>={ADMIN:["contract.view","contract.manage","contract.review.manager","contract.review.legal","contract.approve","contract.signature.manage","contract.service-order.create"],KAM:["contract.view","contract.manage","contract.signature.manage","contract.service-order.create"],TEAM_MANAGER:["contract.view","contract.review.manager"],LEGAL:["contract.view","contract.review.legal"],SALES_DIRECTOR:["contract.view","contract.approve"],ORDER_OPERATIONS:["contract.view","contract.manage","contract.signature.manage","contract.service-order.create"],CUSTOMER_SUCCESS:["contract.view"]};
  for(const[roleCode,codes]of Object.entries(contractPermissionMatrix))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const activityStatuses = [["OPEN","Open","OPEN",false],["IN_PROGRESS","In Progress","ACTIVE",false],["COMPLETED","Completed","CLOSED",true],["CANCELLED","Cancelled","CLOSED",true]] as const;
  for(const[sortOrder,[code,label,reportingCategory,terminal]]of activityStatuses.entries())await prisma.activityStatusDefinition.upsert({where:{code},update:{label,sortOrder,reportingCategory,terminal,active:true},create:{code,label,sortOrder,reportingCategory,terminal}});
  const activityTransitions = [["OPEN","IN_PROGRESS"],["OPEN","COMPLETED"],["IN_PROGRESS","OPEN"],["IN_PROGRESS","COMPLETED"]] as const;
  for(const[fromStatusCode,toStatusCode]of activityTransitions)await prisma.activityStatusTransition.upsert({where:{fromStatusCode_toStatusCode:{fromStatusCode,toStatusCode}},update:{requiredPermission:"activity.complete",ownerOnly:true,active:true},create:{fromStatusCode,toStatusCode,requiredPermission:"activity.complete",ownerOnly:true}});
  const activityPermissionMatrix:Record<string,string[]>={ADMIN:["activity.assign","activity.complete"],TEAM_MANAGER:["activity.assign","activity.complete"],KAM:["activity.complete"],PRESALES:["activity.complete"],SOLUTION_ARCHITECT:["activity.complete"],COVERAGE:["activity.complete"],ORDER_OPERATIONS:["activity.complete"],CUSTOMER_SUCCESS:["activity.complete"]};
  for(const[roleCode,codes]of Object.entries(activityPermissionMatrix))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const salesNavigation = [NAVIGATION_PERMISSIONS.prospects,NAVIGATION_PERMISSIONS.leads,NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.activities];
  const commercialNavigation = [NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.coverage,NAVIGATION_PERMISSIONS.solutionDesigns,NAVIGATION_PERMISSIONS.siteSurveys,NAVIGATION_PERMISSIONS.boqs,NAVIGATION_PERMISSIONS.products,NAVIGATION_PERMISSIONS.proposals,NAVIGATION_PERMISSIONS.quotes,NAVIGATION_PERMISSIONS.contracts,NAVIGATION_PERMISSIONS.approvals];
  const adminNavigation = [NAVIGATION_PERMISSIONS.adminUsers,NAVIGATION_PERMISSIONS.adminOrganization,NAVIGATION_PERMISSIONS.adminAudit,NAVIGATION_PERMISSIONS.adminDeletedRecords,NAVIGATION_PERMISSIONS.adminAiSettings,NAVIGATION_PERMISSIONS.adminRiskRules,NAVIGATION_PERMISSIONS.adminWorkflow,NAVIGATION_PERMISSIONS.adminLeadManagement,NAVIGATION_PERMISSIONS.adminServiceCategories];
  const salesCreate = [QUICK_CREATE_PERMISSIONS.prospect,QUICK_CREATE_PERMISSIONS.lead,QUICK_CREATE_PERMISSIONS.customer,QUICK_CREATE_PERMISSIONS.opportunity,QUICK_CREATE_PERMISSIONS.activity,QUICK_CREATE_PERMISSIONS.proposal,QUICK_CREATE_PERMISSIONS.quote,QUICK_CREATE_PERMISSIONS.contract];
  const roleNavigationPermissionMatrix:Record<string,string[]>={
    ADMIN:[...salesNavigation,...commercialNavigation,...adminNavigation,...salesCreate],
    SYSTEM_ADMIN:[...adminNavigation],
    EXECUTIVE:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.quotes,NAVIGATION_PERMISSIONS.contracts],
    SALES_DIRECTOR:[...salesNavigation,...commercialNavigation,...salesCreate],
    TEAM_MANAGER:[...salesNavigation,...commercialNavigation,...salesCreate],
    KAM:[...salesNavigation,...commercialNavigation,...salesCreate],
    PRESALES:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.coverage,NAVIGATION_PERMISSIONS.solutionDesigns,NAVIGATION_PERMISSIONS.siteSurveys,NAVIGATION_PERMISSIONS.boqs,NAVIGATION_PERMISSIONS.products,NAVIGATION_PERMISSIONS.proposals,QUICK_CREATE_PERMISSIONS.activity,QUICK_CREATE_PERMISSIONS.proposal],
    SOLUTION_ARCHITECT:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.coverage,NAVIGATION_PERMISSIONS.solutionDesigns,NAVIGATION_PERMISSIONS.siteSurveys,NAVIGATION_PERMISSIONS.boqs,NAVIGATION_PERMISSIONS.products,QUICK_CREATE_PERMISSIONS.activity],
    MARKETING:[NAVIGATION_PERMISSIONS.prospects,NAVIGATION_PERMISSIONS.leads,NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.activities,QUICK_CREATE_PERMISSIONS.prospect,QUICK_CREATE_PERMISSIONS.lead,QUICK_CREATE_PERMISSIONS.activity],
    COVERAGE:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.coverage,NAVIGATION_PERMISSIONS.solutionDesigns,NAVIGATION_PERMISSIONS.siteSurveys,NAVIGATION_PERMISSIONS.boqs,QUICK_CREATE_PERMISSIONS.activity],
    PRICING_APPROVER:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.solutionDesigns,NAVIGATION_PERMISSIONS.boqs,NAVIGATION_PERMISSIONS.products,NAVIGATION_PERMISSIONS.proposals,NAVIGATION_PERMISSIONS.quotes,NAVIGATION_PERMISSIONS.approvals],
    LEGAL:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.contracts,NAVIGATION_PERMISSIONS.approvals,QUICK_CREATE_PERMISSIONS.activity],
    ORDER_OPERATIONS:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.coverage,NAVIGATION_PERMISSIONS.contracts,QUICK_CREATE_PERMISSIONS.activity],
    CUSTOMER_SUCCESS:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.contracts,QUICK_CREATE_PERMISSIONS.activity],
    VIEWER:[...salesNavigation,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.proposals,NAVIGATION_PERMISSIONS.quotes,NAVIGATION_PERMISSIONS.contracts],
    AUDITOR:[...salesNavigation,...commercialNavigation,NAVIGATION_PERMISSIONS.adminAudit],
    CUSTOMER_DATA_OWNER:[NAVIGATION_PERMISSIONS.prospects,NAVIGATION_PERMISSIONS.leads,NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities],
    DATA_STEWARD:[NAVIGATION_PERMISSIONS.prospects,NAVIGATION_PERMISSIONS.leads,NAVIGATION_PERMISSIONS.customers],
    COMMERCIAL_COMMITTEE:[NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.proposals,NAVIGATION_PERMISSIONS.quotes,NAVIGATION_PERMISSIONS.contracts,NAVIGATION_PERMISSIONS.approvals],
  };
  for(const[roleCode,codes]of Object.entries(roleNavigationPermissionMatrix))for(const permissionCode of new Set(codes))await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const dashboardBase=[DASHBOARD_PERMISSIONS.view,DASHBOARD_PERMISSIONS.export];
  const dashboardPermissionMatrix:Record<string,string[]>={
    ADMIN:[...dashboardBase,DASHBOARD_PERMISSIONS.executive,DASHBOARD_PERMISSIONS.sales,DASHBOARD_PERMISSIONS.salesManager,DASHBOARD_PERMISSIONS.solution,DASHBOARD_PERMISSIONS.approver,DASHBOARD_PERMISSIONS.operations,DASHBOARD_PERMISSIONS.customerSuccess,DASHBOARD_PERMISSIONS.admin],
    SYSTEM_ADMIN:[...dashboardBase,DASHBOARD_PERMISSIONS.admin],
    EXECUTIVE:[...dashboardBase,DASHBOARD_PERMISSIONS.executive],
    SALES_DIRECTOR:[...dashboardBase,DASHBOARD_PERMISSIONS.executive,DASHBOARD_PERMISSIONS.salesManager,DASHBOARD_PERMISSIONS.approver],
    TEAM_MANAGER:[...dashboardBase,DASHBOARD_PERMISSIONS.salesManager,DASHBOARD_PERMISSIONS.approver],
    KAM:[...dashboardBase,DASHBOARD_PERMISSIONS.sales],
    PRESALES:[...dashboardBase,DASHBOARD_PERMISSIONS.solution],
    SOLUTION_ARCHITECT:[...dashboardBase,DASHBOARD_PERMISSIONS.solution],
    MARKETING:[...dashboardBase,DASHBOARD_PERMISSIONS.sales],
    COVERAGE:[...dashboardBase,DASHBOARD_PERMISSIONS.solution],
    PRICING_APPROVER:[...dashboardBase,DASHBOARD_PERMISSIONS.approver],
    LEGAL:[...dashboardBase,DASHBOARD_PERMISSIONS.approver],
    ORDER_OPERATIONS:[...dashboardBase,DASHBOARD_PERMISSIONS.operations],
    CUSTOMER_SUCCESS:[...dashboardBase,DASHBOARD_PERMISSIONS.customerSuccess],
    VIEWER:[DASHBOARD_PERMISSIONS.view],
    AUDITOR:[...dashboardBase,DASHBOARD_PERMISSIONS.executive,DASHBOARD_PERMISSIONS.admin],
    CUSTOMER_DATA_OWNER:[...dashboardBase,DASHBOARD_PERMISSIONS.customerSuccess],
    DATA_STEWARD:[...dashboardBase,DASHBOARD_PERMISSIONS.customerSuccess],
    COMMERCIAL_COMMITTEE:[...dashboardBase,DASHBOARD_PERMISSIONS.approver],
  };
  for(const[roleCode,codes]of Object.entries(dashboardPermissionMatrix))for(const permissionCode of new Set(codes))await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const dashboardDrilldownPermissions=[NAVIGATION_PERMISSIONS.prospects,NAVIGATION_PERMISSIONS.leads,NAVIGATION_PERMISSIONS.customers,NAVIGATION_PERMISSIONS.opportunities,NAVIGATION_PERMISSIONS.pipeline,NAVIGATION_PERMISSIONS.approvals,NAVIGATION_PERMISSIONS.activities,NAVIGATION_PERMISSIONS.contracts,"prospect.view","prospect.view_all","contract.view"];
  for(const roleCode of Object.keys(dashboardPermissionMatrix))for(const permissionCode of dashboardDrilldownPermissions)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  if (!demoMode) return;
  const demoPassword = process.env.SEED_DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 12) throw new Error("Set SEED_DEMO_PASSWORD to 12+ characters when SEED_DEMO_DATA=1.");
  const passwordHash = await hash(demoPassword, 12);
  const unit = await prisma.organizationUnit.upsert({ where: { code: "DEMO-ENTERPRISE-SALES" }, update: { active: true }, create: { code: "DEMO-ENTERPRISE-SALES", name: "ทีมขายองค์กร (ข้อมูลทดสอบ)" } });
  const people = [
    ["sales1@example.test", "พนักงานขายทดสอบ 1", "KAM", "SELF"],
    ["sales2@example.test", "พนักงานขายทดสอบ 2", "KAM", "SELF"],
    ["sales3@example.test", "พนักงานขายทดสอบ 3", "KAM", "SELF"],
    ["manager@example.test", "ผู้จัดการฝ่ายขายทดสอบ", "TEAM_MANAGER", "TEAM"],
    ["director@example.test", "ผู้อำนวยการฝ่ายขายทดสอบ", "SALES_DIRECTOR", "ORG_UNIT"],
    ["marketing@example.test", "การตลาดทดสอบ", "MARKETING", "ORG_UNIT"],
    ["architect@example.test", "Solution Architect ทดสอบ", "SOLUTION_ARCHITECT", "ORG_UNIT"],
    ["presales@example.test", "Pre-Sales Engineer ทดสอบ", "PRESALES", "ORG_UNIT"],
    ["survey@example.test", "Survey Engineer ทดสอบ", "COVERAGE", "ASSIGNED_TASK"],
    ["pricing@example.test", "Commercial Approver ทดสอบ", "PRICING_APPROVER", "ORG_UNIT"],
    ["legal@example.test", "Legal Reviewer ทดสอบ", "LEGAL", "ORG_UNIT"],
    ["contract@example.test", "Contract Officer ทดสอบ", "ORDER_OPERATIONS", "ORG_UNIT"],
    ["contract2@example.test", "Contract Officer ทดสอบ 2", "ORDER_OPERATIONS", "ORG_UNIT"],
    ["executive@example.test", "Executive Dashboard ทดสอบ", "EXECUTIVE", "ENTERPRISE"],
    ["success@example.test", "Customer Success ทดสอบ", "CUSTOMER_SUCCESS", "ORG_UNIT"],
  ] as const;
  const users = [];
  for (const [userEmail, name, roleCode, scopeCode] of people) {
    const user = await prisma.user.upsert({ where: { email: userEmail }, update: { name, passwordHash, active: true }, create: { email: userEmail, name, passwordHash, role: Role.SALES } });
    users.push(user);
    const existing = await prisma.userRoleAssignment.findFirst({ where: { userId: user.id, roleCode, scopeCode, organizationUnitId: unit.id, active: true } });
    if (!existing) await prisma.userRoleAssignment.create({ data: { userId: user.id, roleCode, scopeCode, organizationUnitId: unit.id, effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
  }
  const dashboardAdmin=await prisma.user.upsert({where:{email:"admin-dashboard@example.test"},update:{name:"Dashboard Admin ทดสอบ",passwordHash,active:true,role:Role.ADMIN},create:{email:"admin-dashboard@example.test",name:"Dashboard Admin ทดสอบ",passwordHash,role:Role.ADMIN}});
  const dashboardAdminAssignment=await prisma.userRoleAssignment.findFirst({where:{userId:dashboardAdmin.id,roleCode:"ADMIN",scopeCode:"ENTERPRISE",organizationUnitId:null,active:true}});
  if(!dashboardAdminAssignment)await prisma.userRoleAssignment.create({data:{userId:dashboardAdmin.id,roleCode:"ADMIN",scopeCode:"ENTERPRISE",effectiveFrom:new Date("2026-01-01T00:00:00Z")}});
  const adminAssignment = await prisma.userRoleAssignment.findFirst({ where: { userId: admin.id, roleCode: "ADMIN", scopeCode: "ENTERPRISE", active: true } });
  if (!adminAssignment) await prisma.userRoleAssignment.create({ data: { userId: admin.id, roleCode: "ADMIN", scopeCode: "ENTERPRISE", effectiveFrom: new Date("2026-01-01T00:00:00Z") } });
  const prospectPermissions = ["prospect.view","prospect.create","prospect.update","prospect.assign","prospect.convert","prospect.merge","prospect.archive","prospect.import","prospect.export","prospect.view_all"];
  const permissionMatrix:Record<string,string[]>={ADMIN:[...prospectPermissions,"prospect.soft_delete","prospect.view_deleted","prospect.restore","lead.archive","customer.lifecycle.manage"],SYSTEM_ADMIN:["prospect.view_deleted","prospect.restore","prospect.permanent_delete"],SALES_DIRECTOR:prospectPermissions,TEAM_MANAGER:[...prospectPermissions.filter(code=>code!=="prospect.view_all"),"prospect.soft_delete"],KAM:["prospect.view","prospect.create","prospect.update","prospect.convert","prospect.export"],MARKETING:["prospect.view","prospect.create","prospect.import","prospect.export"]};
  permissionMatrix.ADMIN.push("opportunity.probability.override");
  permissionMatrix.ADMIN.push("activity.assign","activity.complete");
  permissionMatrix.TEAM_MANAGER.push("activity.assign","activity.complete");
  permissionMatrix.KAM.push("activity.complete");
  permissionMatrix.ADMIN.push("solution-design.view","solution-design.manage","solution-design.submit","solution-design.technical.approve","solution-design.commercial.approve","site-survey.view","site-survey.request","site-survey.coordinate","site-survey.perform","site-survey.result.approve","boq.view","boq.manage","boq.cost.view","boq.approve");
  permissionMatrix.KAM.push("solution-design.view","solution-design.manage","site-survey.view","site-survey.request","boq.view");
  permissionMatrix.PRESALES=["solution-design.view","solution-design.manage","solution-design.submit","site-survey.view","site-survey.request","site-survey.perform","boq.view","boq.manage","boq.cost.view"];
  permissionMatrix.SOLUTION_ARCHITECT=["solution-design.view","solution-design.manage","solution-design.submit","solution-design.technical.approve","site-survey.view","site-survey.coordinate","site-survey.result.approve","boq.view","boq.manage","boq.cost.view"];
  permissionMatrix.COVERAGE=["solution-design.view","site-survey.view","site-survey.coordinate","site-survey.perform"];
  permissionMatrix.PRICING_APPROVER=["solution-design.view","solution-design.commercial.approve","boq.view","boq.cost.view","boq.approve"];
  permissionMatrix.ADMIN.push("forecast.target.manage", "forecast.calendar.manage", "forecast.snapshot.create");
  permissionMatrix.SALES_DIRECTOR.push("opportunity.probability.override");
  permissionMatrix.SALES_DIRECTOR.push("forecast.target.manage", "forecast.snapshot.create");
  permissionMatrix.TEAM_MANAGER.push("opportunity.probability.override");
  permissionMatrix.TEAM_MANAGER.push("forecast.target.manage", "forecast.snapshot.create");
  for(const [roleCode,codes] of Object.entries(permissionMatrix))for(const permissionCode of codes)await prisma.rolePermissionGrant.upsert({where:{roleCode_permissionCode:{roleCode,permissionCode}},update:{},create:{roleCode,permissionCode}});
  const productSeeds=[
    {code:"NT-BB-1000",name:"NT Broadband Internet 1 Gbps",category:"Broadband",serviceCategoryCode:"BROADBAND",listPrice:"25000.0000",standardCost:"12000.0000",requiresSiteSurvey:false,requiresBoq:false,requiresPhysicalInstallation:false},
    {code:"NT-DIA-1000",name:"NT Dedicated Internet 1 Gbps",category:"Datacom",serviceCategoryCode:"DATACOM",listPrice:"85000.0000",standardCost:"45000.0000",requiresSiteSurvey:false,requiresBoq:false,requiresPhysicalInstallation:false},
    {code:"NT-MPLS-100",name:"NT MPLS 100 Mbps",category:"Datacom",serviceCategoryCode:"DATACOM",listPrice:"42000.0000",standardCost:"23000.0000",requiresSiteSurvey:false,requiresBoq:false,requiresPhysicalInstallation:false},
    {code:"NT-CLOUD-MANAGED",name:"NT Managed Cloud Service",category:"Cloud",serviceCategoryCode:null,listPrice:"30000.0000",standardCost:"18000.0000",requiresSiteSurvey:false,requiresBoq:false,requiresPhysicalInstallation:false},
  ];
  for(const product of productSeeds){const data={...product,costConfirmedAt:new Date("2026-01-01T00:00:00Z")};await prisma.product.upsert({where:{code:product.code},update:data,create:data});}
  const customerSegments = [
    ["G1","รัฐบาลส่วนกลางและหน่วยงานกำกับ"],["G2","รัฐวิสาหกิจ"],["G3","องค์กรปกครองส่วนท้องถิ่น"],["G4","การศึกษาและสาธารณสุขภาครัฐ"],["G5","ความมั่นคงและโครงสร้างพื้นฐานสำคัญ"],
    ["B1","องค์กรธุรกิจขนาดใหญ่"],["B2","องค์กรธุรกิจขนาดกลาง"],["B3","ธุรกิจขนาดเล็กและ SME"],["B4","ผู้ให้บริการ พันธมิตร และธุรกิจดิจิทัล"],
  ] as const;
  for (const [displayOrder,[code,name]] of customerSegments.entries()) await prisma.customerSegment.upsert({ where:{code}, update:{name,active:true,displayOrder:(displayOrder+1)*10}, create:{code,name,displayOrder:(displayOrder+1)*10} });
  const subIndustries = [
    ["G1-ADMIN","ส่วนราชการและหน่วยงานบริหาร","G1"],["G1-REG","หน่วยงานกำกับดูแล","G1"],["G2-ENERGY","พลังงานและสาธารณูปโภค","G2"],["G2-TELCO","โทรคมนาคมภาครัฐ","G2"],["G2-TRANS","ขนส่งและโลจิสติกส์ภาครัฐ","G2"],
    ["G3-LOCAL","องค์การบริหารส่วนจังหวัด เทศบาล และ อบต.","G3"],["G3-SMART","เมืองอัจฉริยะและบริการประชาชน","G3"],["G4-EDU","สถานศึกษาและมหาวิทยาลัยภาครัฐ","G4"],["G4-HEALTH","โรงพยาบาลและสาธารณสุขภาครัฐ","G4"],["G5-DEF","ความมั่นคงและการป้องกันประเทศ","G5"],["G5-INFRA","โครงสร้างพื้นฐานสำคัญ","G5"],
    ["B1-BANK","ธนาคารและบริการทางการเงิน","B1"],["B1-ENERGY","พลังงานและปิโตรเคมี","B1"],["B1-MFG","การผลิตอุตสาหกรรม","B1"],["B1-RETAIL","ค้าปลีกและธุรกิจขนาดใหญ่","B1"],["B2-CONST","ก่อสร้างและอสังหาริมทรัพย์","B2"],["B2-HOSP","โรงแรมและการท่องเที่ยว","B2"],["B2-LOGI","โลจิสติกส์และขนส่ง","B2"],["B2-SVC","บริการวิชาชีพ","B2"],
    ["B3-MFG","การผลิต SME","B3"],["B3-RETAIL","ค้าปลีก SME","B3"],["B3-SVC","บริการ SME","B3"],["B4-CLOUD","Cloud และธุรกิจดิจิทัล","B4"],["B4-SI","System Integrator","B4"],["B4-TELCO","ผู้ให้บริการโทรคมนาคม","B4"],["B4-PARTNER","ตัวแทนจำหน่ายและพันธมิตร","B4"],
  ] as const;
  const subIndustryOrder = new Map<string,number>();
  for (const [code,name,segmentCode] of subIndustries) { const displayOrder=(subIndustryOrder.get(segmentCode)??0)+10; subIndustryOrder.set(segmentCode,displayOrder); await prisma.subIndustryReference.upsert({where:{code},update:{name,segmentCode,active:true,displayOrder},create:{code,name,segmentCode,displayOrder}}); }
  for (const [index,province] of THAI_PROVINCES.entries()) await prisma.provinceReference.upsert({where:{code:province.code},update:{name:province.name,region:province.region,active:true,displayOrder:(index+1)*10},create:{...province,displayOrder:(index+1)*10}});
  for (const [index,district] of THAI_DISTRICTS.entries()) await prisma.districtReference.upsert({where:{code:district.code},update:{provinceCode:district.provinceCode,name:district.name,active:true,displayOrder:(index+1)*10},create:{...district,displayOrder:(index+1)*10}});
  const industries=await Promise.all([["GOV","ภาครัฐ"],["FIN","การเงินและธนาคาร"],["MFG","การผลิต"],["RET","ค้าปลีก"],["HEALTH","สาธารณสุข"]].map(([code,name])=>prisma.industry.upsert({where:{code},update:{active:true},create:{code,name}})));
  const territories=await Promise.all([["BKK","กรุงเทพมหานคร","CENTRAL"],["NORTH","ภาคเหนือ","NORTH"],["NE","ภาคตะวันออกเฉียงเหนือ","NORTHEAST"],["SOUTH","ภาคใต้","SOUTH"]].map(([code,name,region])=>prisma.salesTerritory.upsert({where:{code},update:{active:true},create:{code,name,region}})));
  await prisma.prospectScoringRuleVersion.upsert({where:{version:1},update:{active:true},create:{version:1,active:true,createdById:admin.id,hotThreshold:75,warmThreshold:40,weights:{estimatedValue:15,companySize:8,branches:7,industryFit:8,contractTiming:8,contactFrequency:8,interest:10,budget:8,purchasePeriod:7,sourceQuality:6,aiScore:8,recency:4,completeness:3}}});
  const campaigns = await Promise.all([
    prisma.campaign.upsert({ where: { code: "DEMO-CLOUD-2026" }, update: { active: true }, create: { code: "DEMO-CLOUD-2026", name: "Cloud Enterprise Demo 2026", source: "MARKETING" } }),
    prisma.campaign.upsert({ where: { code: "DEMO-GOV-2026" }, update: { active: true }, create: { code: "DEMO-GOV-2026", name: "Government Digital Demo 2026", source: "EVENT" } }),
  ]);
  const statuses = [LeadStatus.NEW, LeadStatus.ASSIGNED, LeadStatus.CONTACTED, LeadStatus.NURTURING, LeadStatus.QUALIFIED, LeadStatus.DISQUALIFIED, LeadStatus.CONVERTED, LeadStatus.ARCHIVED];
  const temperatures = [LeadTemperature.HOT, LeadTemperature.WARM, LeadTemperature.COLD];
  for (let index = 0; index < 20; index += 1) {
    const owner = users[index % 3]; const status = statuses[index % statuses.length]; const temperature = temperatures[index % temperatures.length];
    await prisma.lead.upsert({
      where: { leadNumber: `DEMO-L-${String(index + 1).padStart(4, "0")}` },
      update: {},
      create: { leadNumber: `DEMO-L-${String(index + 1).padStart(4, "0")}`, company: index >= 18 ? "บริษัทตัวอย่างซ้ำ จำกัด" : `บริษัทตัวอย่าง ${index + 1} จำกัด`, contactName: `ผู้ติดต่อทดสอบ ${index + 1}`, contactEmail: `lead${index + 1}@example.test`, contactPhone: `080000${String(index + 1).padStart(4, "0")}`, source: index % 2 ? LeadSource.MARKETING_CAMPAIGN : LeadSource.WEBSITE, campaignId: campaigns[index % campaigns.length].id, status, temperature, score: temperature === LeadTemperature.HOT ? 80 : temperature === LeadTemperature.WARM ? 55 : 25, ownerId: owner.id, organizationUnitId: unit.id, recommendedProducts: "บริการทดสอบ NT", requirementSummary: status === LeadStatus.QUALIFIED ? "ความต้องการสมมติสำหรับทดสอบ conversion" : null, estimatedBudget: status === LeadStatus.QUALIFIED ? "1000000.0000" : null, nextFollowUpAt: index === 17 ? new Date("2026-01-01T02:00:00Z") : null },
    });
  }
  const prospectStatuses=[ProspectStatus.NEW,ProspectStatus.ASSIGNED,ProspectStatus.CONTACTED,ProspectStatus.INTERESTED,ProspectStatus.QUALIFYING,ProspectStatus.QUALIFIED,ProspectStatus.NOT_INTERESTED,ProspectStatus.UNREACHABLE,ProspectStatus.LOST,ProspectStatus.CONVERTED,ProspectStatus.ARCHIVED];
  const prospectSources=[ProspectSource.MANUAL,ProspectSource.WEBSITE,ProspectSource.LINE_OA,ProspectSource.CALL_CENTER,ProspectSource.EVENT,ProspectSource.PARTNER,ProspectSource.REFERRAL,ProspectSource.TENDER,ProspectSource.GOVERNMENT_PROJECT,ProspectSource.COMPANY_REGISTRY,ProspectSource.IMPORT];
  const provinces=["กรุงเทพมหานคร","เชียงใหม่","ขอนแก่น","สงขลา","ชลบุรี"],regions=["CENTRAL","NORTH","NORTHEAST","SOUTH","EAST"];
  for(let index=0;index<20;index+=1){const owner=users[index%3],status=prospectStatuses[index%prospectStatuses.length],heat=[ProspectHeatLevel.HOT,ProspectHeatLevel.WARM,ProspectHeatLevel.COLD][index%3],prospect=await prisma.prospect.upsert({where:{prospectCode:`DEMO-P-${String(index+1).padStart(4,"0")}`},update:{},create:{prospectCode:`DEMO-P-${String(index+1).padStart(4,"0")}`,companyName:`องค์กรเป้าหมายทดสอบ ${index+1}`,companyNameEnglish:`Demo Prospect ${index+1}`,normalizedCompanyName:`องค์กรเป้าหมายทดสอบ${index+1}`,normalizedCompanyEnglish:`demoprospect${index+1}`,taxId:`99999${String(index+1).padStart(8,"0")}`,industryId:industries[index%industries.length].id,province:provinces[index%provinces.length],region:regions[index%regions.length],salesTerritoryId:territories[index%territories.length].id,responsibleBusinessUnitId:unit.id,salesTeamId:unit.id,ownerId:owner.id,status,source:prospectSources[index%prospectSources.length],heatLevel:heat,calculatedScore:heat==="HOT"?82:heat==="WARM"?55:25,aiOpportunityScore:70+(index%25),aiConfidenceScore:65+(index%20),aiRiskScore:15+(index%40),estimatedOpportunityValue:`${(index+1)*250000}.0000`,expectedBudget:`${(index+1)*200000}.0000`,numberOfBranches:(index%8)+1,numberOfEmployees:(index+1)*40,businessPainPoints:"ข้อมูล pain point สังเคราะห์สำหรับทดสอบ",recommendedProducts:"NT Cloud, Cybersecurity, Managed Service",nextFollowUpAt:index%4===0?new Date("2026-07-01T02:00:00Z"):new Date("2026-08-01T02:00:00Z"),createdById:admin.id,updatedById:admin.id,contacts:{create:{name:`ผู้ติดต่อ Prospect ${index+1}`,position:"ผู้จัดการ",mobile:`081111${String(index+1).padStart(4,"0")}`,email:`prospect${index+1}@example.test`,preferredContactChannel:"MOBILE",isPrimary:true,createdById:admin.id,updatedById:admin.id}}}});if(!(await prisma.activity.count({where:{prospectId:prospect.id}})))await prisma.activity.create({data:{prospectId:prospect.id,ownerId:owner.id,type:index%2?ActivityType.PHONE_CALL:ActivityType.MEETING,subject:"กิจกรรมตัวอย่าง Prospect",description:"กิจกรรมสังเคราะห์สำหรับ Dashboard และ Timeline",activityAt:new Date("2026-07-10T03:00:00Z"),nextFollowUpAt:prospect.nextFollowUpAt}});}
}

main().finally(() => prisma.$disconnect());
