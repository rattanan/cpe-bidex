"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const selector = "[data-expandable-text], .detail-value, .timeline p, .related-list article p, .document-row p, .prospect-activity-summary p, .card-body p:not(.help):not(.form-feedback):not(.notice), .table td";

export function shouldCollapseText(value:string){return value.length>220||value.split(/\r?\n/).length>4;}

export function ExpandableTextAssistance(){
  const pathname=usePathname();
  useEffect(()=>{
    if(pathname.startsWith("/cpe"))return;
    const enhance=(root:ParentNode)=>root.querySelectorAll<HTMLElement>(selector).forEach(element=>{
      if(element.dataset.expandableReady||!shouldCollapseText(element.textContent??""))return;
      if(element.querySelector("button,a,input,textarea,select"))return;
      element.dataset.expandableReady="true";element.classList.add("expandable-text","is-collapsed");
      if(!element.id)element.id=`expandable-text-${crypto.randomUUID()}`;const button=document.createElement("button");button.type="button";button.className="read-more-button";button.textContent="อ่านเพิ่มเติม";button.setAttribute("aria-expanded","false");button.setAttribute("aria-controls",element.id);
      button.addEventListener("click",()=>{const collapsed=element.classList.toggle("is-collapsed");button.textContent=collapsed?"อ่านเพิ่มเติม":"ย่อข้อความ";button.setAttribute("aria-expanded",String(!collapsed));});
      element.insertAdjacentElement("afterend",button);
    });
    enhance(document);const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node instanceof HTMLElement)enhance(node);})));observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect();
  },[pathname]);
  return null;
}
