self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",(event)=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",(event)=>{
  let payload={title:"Chợ Phú Thọ",body:"Bạn có thông báo mới.",url:"/"};
  try{payload={...payload,...(event.data?event.data.json():{})}}catch{}
  event.waitUntil(self.registration.showNotification(payload.title,{
    body:payload.body,
    icon:"/logo.png",
    badge:"/logo.png",
    tag:payload.type||"ptmarket",
    data:{url:payload.url||"/"}
  }));
});
self.addEventListener("notificationclick",(event)=>{
  event.notification.close();
  const target=event.notification.data?.url||"/";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if("focus" in client){client.navigate(target);return client.focus();}
    }
    if(clients.openWindow)return clients.openWindow(target);
  }));
});