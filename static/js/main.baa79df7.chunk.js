(this.webpackJsonpLoboReader=this.webpackJsonpLoboReader||[]).push([[0],{127:function(e,t,n){},129:function(e,t,n){"use strict";n.r(t);var r=n(0),c=n.n(r),i=n(39),a=n.n(i),o=n(15),s=n(94),u=n(26),d=n(146),l=n(130),j=n(9),b=n(82),h=n(11),p=n(145),f=n(92),O=n(64),x=n(131),m=n(5),v=n(148),g=n(28),w=n(151),y=n(18),k=n(6),S=n.n(k),A=n(14),I=n(48),E=n(142),C=n(90),R=n.n(C),B=n(3),P=n(147),N=n(152),z=n(61),L=n(96),T=n(40),D=n(41),M=n(85),_=n.n(M),q=function(e){return new URLSearchParams(e).toString()},H=function(){var e=Object(A.a)(S.a.mark((function e(t,n){var r;return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,_()(t,n);case 2:return r=e.sent,e.next=5,r.json();case 5:return e.abrupt("return",e.sent);case 6:case"end":return e.stop()}}),e)})));return function(t,n){return e.apply(this,arguments)}}(),F=function(){function e(){Object(T.a)(this,e),this.API_BASE="https://api.archivelab.org/v1/books/"}return Object(D.a)(e,[{key:"get",value:function(){var e=Object(A.a)(S.a.mark((function e(t){var n,r,c;return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(n=t.identifier,r=void 0===n?null:n){e.next=3;break}throw new Error("Missing required arg 'identifier'");case 3:return c="".concat(this.API_BASE,"/").concat(r),e.abrupt("return",H(c));case 5:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()},{key:"metadata",value:function(){var e=Object(A.a)(S.a.mark((function e(t){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,this.get({identifier:t});case 2:return e.abrupt("return",e.sent);case 3:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()}]),e}(),Q=function(){function e(){Object(T.a)(this,e),this.API_BASE="https://api.archivelab.org/v1/books/"}return Object(D.a)(e,[{key:"get",value:function(){var e=Object(A.a)(S.a.mark((function e(t){var n,r,c;return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(n=t.identifier,r=void 0===n?null:n){e.next=3;break}throw new Error("Missing required arg 'identifier'");case 3:return c="".concat(this.API_BASE,"/").concat(r,"/ia_manifest"),e.abrupt("return",H(c));case 5:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()},{key:"metadata",value:function(){var e=Object(A.a)(S.a.mark((function e(t){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,this.get({identifier:t});case 2:return e.abrupt("return",e.sent);case 3:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()}]),e}(),W=function(){function e(){Object(T.a)(this,e),this.API_BASE="https://api.archivelab.org/v1/books/"}return Object(D.a)(e,[{key:"get",value:function(){var e=Object(A.a)(S.a.mark((function e(t){var n,r,c;return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(n=t.identifier,r=void 0===n?null:n){e.next=3;break}throw new Error("Missing required arg 'identifier'");case 3:return c="".concat(this.API_BASE,"/").concat(r,"/pages"),e.abrupt("return",H(c));case 5:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()},{key:"pages",value:function(){var e=Object(A.a)(S.a.mark((function e(t){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,this.get({identifier:t});case 2:return e.abrupt("return",e.sent);case 3:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()}]),e}(),G={SearchAPI:new(function(){function e(){Object(T.a)(this,e),this.API_BASE="https://archive.org/advancedsearch.php"}return Object(D.a)(e,[{key:"get",value:function(){var e=Object(A.a)(S.a.mark((function e(){var t,n,r,c,i,a,o,s,u,d,l,j=arguments;return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:if(t=j.length>0&&void 0!==j[0]?j[0]:{},n=t.q,r=void 0===n?null:n,c=t.page,i=void 0===c?1:c,a=t.fields,o=void 0===a?["identifier"]:a,s=Object(L.a)(t,["q","page","fields"]),r){e.next=3;break}throw new Error("Missing required arg 'q'");case 3:return"object"==typeof r&&(r=this.buildQueryFromObject(r)),u=Object(z.a)(Object(z.a)({q:r,page:i,fl:o},s),{},{output:"json"}),d=q(u),l="".concat(this.API_BASE,"?").concat(d),e.abrupt("return",H(l));case 8:case"end":return e.stop()}}),e,this)})));return function(){return e.apply(this,arguments)}}()},{key:"search",value:function(){var e=Object(A.a)(S.a.mark((function e(t){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,this.get({q:t});case 2:return e.abrupt("return",e.sent);case 3:case"end":return e.stop()}}),e,this)})));return function(t){return e.apply(this,arguments)}}()},{key:"buildQueryFromObject",value:function(e){return Object.keys(e).map((function(t){return Array.isArray(e[t])?"".concat(t,":( ").concat(e[t].map((function(e){return'"'.concat(e,'"')})).join(" OR ")," )"):"".concat(t,':"').concat(e[t],'"')})).join(" AND ")}}]),e}()),ExpBookAPI:new W,BookMetaAPI:new F,BookManifestAPI:new Q},Y=new(n(86).a)("LoboReader");Y.version(4).stores({collection:"id",acknowledgements:"id"});var Z=Y,$=n(49),J=n(8),U=Object(J.a)("div",Object($.a)({display:"flex",justifyContent:"center",alignItems:"center",height:"100%",marginTop:"32px",marginBottom:"24px",marginRight:"24px"},"height","100%")),V=n(149),K=n(60),X=(n(67),n(140)),ee=n(1),te=Object(h.g)((function(e){var t=function(t){return Object(ee.jsxs)(V.a,{endEnhancer:function(){return function(t){switch(t){case"collection":return Object(ee.jsx)(X.a,{});default:if(e.onEditClick)return Object(ee.jsx)(x.a,{onClick:function(t){return e.onEditClick(t,e.identifier,e.title)},kind:m.a.secondary,size:m.c.mini,children:"Edit"})}return Object(ee.jsx)("div",{})}(e.mediatype,e.editable)},overrides:{Content:{style:{"padding-left":"0px","margin-left":"0px",width:"100%"}}},children:[Object(ee.jsx)(K.LazyLoadImage,{className:"listImg",style:{borderRadius:"5px",verticalAlign:"middle",objectPosition:"0% 0%",width:"64px",height:"36px",minWidth:"64px",minHeight:"36px",objectFit:"cover"},effect:"opacity",src:"https://archive.org/services/img/"+e.identifier,width:"64px"},"https://archive.org/services/img/"+e.identifier),Object(ee.jsx)("div",{className:"description",children:e.title})]},"{props.identifier}")};return function(n){switch(n){case"collection":return Object(ee.jsx)(o.b,{to:"/browse/"+e.identifier,children:Object(ee.jsx)("div",{className:"rowItem",children:t()})});default:return Object(ee.jsx)("div",{className:"rowItem",onClick:function(t){return e.onSelectItem(t,e.identifier,e.title)},children:t()})}}(e.mediatype)})),ne=n(95),re=n(150),ce=n(13),ie=Object(r.forwardRef)((function(e,t){var n=Object(r.useState)(!1),c=Object(j.a)(n,2),i=c[0],a=c[1],o=Object(r.useState)(""),s=Object(j.a)(o,2),u=s[0],d=s[1],l=Object(r.useState)(void 0),b=Object(j.a)(l,2),h=b[0],p=b[1];Object(r.useImperativeHandle)(t,(function(){return{showDrawer:f,hideDrawer:O}}));var f=function(e,t){d(e),p(t),a(!0)},O=function(){a(!1)};return Object(ee.jsx)(re.a,{isOpen:i,autoFocus:!0,onClose:function(){return a(!1)},anchor:ce.a.bottom,size:m.c.auto,children:Object(ee.jsxs)("div",{style:{textAlign:"center"},children:[Object(ee.jsx)(ne.a,{children:void 0!=h?h:""}),Object(ee.jsx)("br",{}),Object(ee.jsx)("img",{src:void 0!=u?"https://archive.org/services/img/"+u:"",style:{maxHeight:"175px",borderRadius:"5px",objectFit:"cover"}}),Object(ee.jsx)("br",{}),Object(ee.jsx)("br",{}),function(){for(var t=[],n=function(n){t.push(Object(ee.jsxs)("div",{children:[Object(ee.jsx)(x.a,{disabled:void 0!=e.buttonDisabled&&e.buttonDisabled(n,u,h),onClick:function(){return e.buttonAction(n,u,h)},children:e.buttonLabel(n,u,h)}),Object(ee.jsx)("br",{}),Object(ee.jsx)("br",{})]}))},r=0;r<e.buttonCount;r++)n(r);return t}()]})})})),ae=Object(h.g)((function(e){var t=Object(r.useState)([]),n=Object(j.a)(t,2),i=n[0],a=n[1],o=Object(r.useState)(1),s=Object(j.a)(o,2),u=s[0],d=s[1],l=Object(r.useState)(!0),b=Object(j.a)(l,2),p=b[0],f=b[1],O=Object(r.useState)(!0),x=Object(j.a)(O,2),m=x[0],v=x[1],g=Object(r.useState)(!1),y=Object(j.a)(g,2),k=y[0],C=y[1],z=Object(r.useState)(void 0),L=Object(j.a)(z,2),T=L[0],D=L[1],M=Object(r.useState)(!1),_=Object(j.a)(M,2),q=_[0],H=_[1],F=Object(r.useState)(!1),Q=Object(j.a)(F,2),W=Q[0],Y=Q[1],$=Object(h.f)(),J=c.a.useRef(null),V=Object(w.b)().enqueue;Object(r.useEffect)((function(){a([]),d(1),f(!0),void 0!==e.match.params.searchQuery?(C(!0),D(e.match.params.searchQuery)):(C(!1),e.match.params.id&&"s"!==e.match.params.id?D(e.match.params.id):D("magazine_rack"))}),[e.location.pathname]),Object(r.useEffect)((function(){a([]),K()}),[T]);var K=function(){d(1),f(!0),ce()},X=function(){var e=Object(A.a)(S.a.mark((function e(t,n){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:Z.collection.get({id:n.identifier}).then((function(e){H(void 0!==e),Y(void 0!==e&&e.archived),J.current.showDrawer(n.identifier,n.title)}));case 1:case"end":return e.stop()}}),e)})));return function(t,n){return e.apply(this,arguments)}}(),ne=function(){var e=Object(A.a)(S.a.mark((function e(t,n){var r;return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.next=2,Z.collection.get({id:t});case 2:r=e.sent,console.log("DBITEM"),console.log(r),void 0===r?Z.collection.add({id:t,title:n,page:0,read:!1,archived:!1},t).then((function(e){re()})):(r.archived=!1,Z.collection.put(r));case 6:case"end":return e.stop()}}),e)})));return function(t,n){return e.apply(this,arguments)}}(),re=function(){V({message:"Item was added.",startEnhancer:function(e){var t=e.size;return Object(ee.jsx)(R.a,{size:t})}})},ce=function(){void 0!=T&&G.SearchAPI.get({q:k?'("'+T+'") (collection:("magazine_rack") AND mediatype:(collection OR texts))':'collection:("'+T+'" AND mediatype:(collection OR texts))',fields:["identifier","title","mediatype","type","metadata"],rows:50,page:u,sort:["mediatype asc","identifier asc"]}).then((function(e){var t=e.response.docs;t.sort((function(e,t){return e.title>t.title?1:t.title>e.title?-1:0})),t.sort((function(e,t){return e.mediaType>t.mediaType?1:t.mediaType>e.mediaType?-1:0})),t=i.concat(t),a(t),v(e.response.numFound>t.length),f(!1),d(u+1)})).catch((function(e){}))},ae=function(e){return""!=k?"/read/"+e+"/p/s/"+T:"/read/"+e+"/p/b/"+T};return Object(ee.jsxs)("div",{className:"page",children:[Object(ee.jsx)("div",{style:{marginTop:"4px",marginRight:"14px"},children:Object(ee.jsx)("form",{action:"",onSubmit:function(e){return function(e){e&&e.preventDefault();var t=document.getElementById("search").value;document.getElementById("search").blur(),$.push("/browse/s/"+t)}(e)},children:Object(ee.jsx)(P.a,{value:k?T:"",id:"search",type:"search",placeholder:"Search the Internet Archive",size:B.d.compact,autoComplete:"false",overrides:{StartEnhancer:{style:{marginLeft:"0px",marginRight:"0px",paddingLeft:"0px",paddingRight:"0px",color:"#888888"}}},startEnhancer:Object(ee.jsx)(E.a,{size:"22px"})})})}),Object(ee.jsx)("div",{style:{fontSize:"85%",paddingTop:"14px",color:"#cbcbcb"},children:function(){if(k)return"Searching for: "+T;switch(T){case"magazine_rack":return"Browsing the Magazine Rack";case null:case void 0:return Object(ee.jsx)("br",{});default:return"Browsing '"+T+"'"}}()}),Object(ee.jsx)(ie,{ref:J,buttonCount:2,buttonLabel:function(e,t,n){switch(e){case 0:return q?"Continue reading":"Start reading";case 1:return W?"Unarchive":"Read later"}},buttonAction:function(e,t,n){switch(e){case 0:!function(e,t){ne(e,t),$.push(ae(e,t))}(t,n);break;case 1:!function(e,t){ne(e,t),J.current.hideDrawer()}(t,n)}},buttonDisabled:function(e,t,n){switch(e){case 0:return!1;default:return q&&!W}}}),i.length>0&&!p?Object(ee.jsxs)("div",{children:[Object(ee.jsx)("ul",{children:i.map((function(e){return Object(ee.jsx)(te,{title:e.title,identifier:e.identifier,mediatype:e.mediatype,onSelectItem:function(t){return X(t,e)}},e.identifier)}))}),Object(ee.jsx)(I.a,{dataLength:i.length,next:function(){ce()},hasMore:m,loader:Object(ee.jsx)(U,{children:Object(ee.jsx)(N.a,{})})})]}):Object(ee.jsx)("div",{children:p?Object(ee.jsx)(U,{children:Object(ee.jsx)(N.a,{})}):Object(ee.jsx)(U,{children:"No results found."})})]})})),oe=function(e){var t=Object(h.f)(),n=c.a.useRef(null),i=Object(r.useState)([]),a=Object(j.a)(i,2),o=a[0],s=a[1],u=Object(r.useState)(!0),d=Object(j.a)(u,2),l=d[0],b=d[1];Object(r.useEffect)((function(){p()}),[]);var p=function(){Z.collection.filter((function(e){return!1===e.archived})).toArray().then((function(e){s(e),b(!1)}))},f=function(){var e=Object(A.a)(S.a.mark((function e(n,r){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:o.find((function(e){return e.id===r})),t.push("/read/"+r+"/p/c");case 2:case"end":return e.stop()}}),e)})));return function(t,n){return e.apply(this,arguments)}}();return Object(ee.jsxs)("div",{className:"page",children:[Object(ee.jsx)(ie,{ref:n,buttonCount:1,buttonLabel:function(e,t,n){switch(e){case 0:return"Archive (hide item)"}},buttonAction:function(e,t,r){switch(e){case 0:!function(e){Z.collection.update({id:e},{archived:!0}).then((function(e){n.current.hideDrawer(),p()}))}(t)}}}),Object(ee.jsx)("div",{style:{marginTop:"4px",marginRight:"14px",fontSize:"85%",color:"#cbcbcb"},children:"Your Collection"}),o.length>0&&!l?Object(ee.jsxs)("div",{id:"go",children:[Object(ee.jsx)("ul",{children:o.map((function(e){return Object(ee.jsx)(te,{title:e.title,identifier:e.id,mediatype:"text",onEditClick:function(t){return function(e,t,r){e.stopPropagation(),n.current.showDrawer(t,r)}(t,e.id,e.title)},onSelectItem:function(t){return f(t,e.id)}},e.id)}))}),Object(ee.jsx)(I.a,{dataLength:o.length,loader:Object(ee.jsx)(U,{children:Object(ee.jsx)(N.a,{})})})]}):Object(ee.jsx)("div",{id:"go",children:l?Object(ee.jsx)(U,{children:Object(ee.jsx)(N.a,{})}):Object(ee.jsx)(U,{children:"Your Collection is empty."})})]})},se=n(91);n(126);var ue=Object(h.g)((function(e){var t=Object(r.useState)([]),n=Object(j.a)(t,2),c=n[0],i=n[1],a=Object(r.useState)(0),o=Object(j.a)(a,2),s=o[0],u=o[1],d=Object(r.useState)(!1),l=Object(j.a)(d,2),b=l[0],p=l[1],f=Object(h.f)(),O=Object(r.useState)(null),x=Object(j.a)(O,2),m=x[0],v=x[1],g=e.match.params.id,w=e.match.params.prevAction,y=e.match.params.prevId;Object(r.useEffect)((function(){G.BookManifestAPI.get({identifier:g}).then((function(e){Z.collection.get({id:g}).then((function(t){void 0!=t?(v(t),u(t.page)):(t={id:e.itemId,title:e.title,page:0,read:!1,archived:!1},v(t),u(0),Z.collection.put(m,g));var n=k(e);i(n),p(!0)}))}))}),[]);var k=function(e){for(var t=[],n=e.numPages,r=0;r<n;r++){r.toString().padStart(4,"0");t.push({src:"https://archive.org/download/".concat(g,"/page/leaf").concat(r).concat("_h1000",".jpg"),w:window.innerWidth,h:window.innerHeight})}return t},I=function(){var e=Object(A.a)(S.a.mark((function e(t){return S.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:m.page=t,Z.collection.put(m,g);case 2:case"end":return e.stop()}}),e)})));return function(t){return e.apply(this,arguments)}}();return Object(ee.jsx)("div",{children:b?Object(ee.jsx)(se.a,{container:c,onIndexChange:I,onOpenChange:function(e){e||(void 0!=w&&void 0!=y?"s"==w?f.push("/browse/s/"+y):f.push("/browse/"+y):"c"==w?f.push("/collection"):f.push("/browse"))}.bind(this),index:s,open:b,options:{index:0,showAnimationDuration:0,hideAnimationDuration:0,fullscreenEl:!1,allowPanToNext:!0,bgOpacity:1,pinchToClose:!1,closeOnScroll:!1,closeOnVerticalDrag:!1,maxSpreadZoom:3,barsSize:{top:16,bottom:"auto"},timeToIdle:3e3,timeToIdleOutside:1e3,captionEl:!1,arrowEl:!0,zoomEl:!1,tapToClose:!1,tapToToggleControls:!0,clickToCloseNonZoomable:!1,getDoubleTapZoom:function(e,t){return 3},history:!1,preload:[1,2],modal:!1},theme:{foreground:"#ffffff",background:"#000000"}}):Object(ee.jsx)("div",{children:Object(ee.jsxs)("div",{className:"page",children:[Object(ee.jsx)("br",{}),Object(ee.jsx)(U,{children:Object(ee.jsx)(N.a,{})})]})})})})),de=n(153),le=n(22),je=n(36),be=n(143),he=function(e){return Object(ee.jsxs)(de.a,{isOpen:e.isOpen,onClose:function(){return e.onClose()},closeable:!0,animate:!0,autoFocus:!0,size:le.c.default,role:le.b.dialog,children:[Object(ee.jsxs)(je.g,{children:["LoboReader",Object(ee.jsx)("br",{}),"for Internet Archive"]}),Object(ee.jsxs)(je.e,{children:["Build date: ","4/11/2021, 10:44:48 PM",Object(ee.jsx)("br",{}),Object(ee.jsx)("br",{}),'LoboReader is an unofficial reader for the Internet Archive "Magazine Rack".',Object(ee.jsx)("br",{}),Object(ee.jsx)("br",{}),"For changelog, docs & licensing please visit project page on GitHub."]}),Object(ee.jsx)(je.f,{children:Object(ee.jsx)(o.b,{to:{pathname:"https://github.com/gitGalu"},target:"_blank",children:Object(ee.jsx)(be.a,{kind:"primiary",children:"Visit GitHub"})})})]})},pe=n(144),fe=function(e){return Object(ee.jsxs)(de.a,{isOpen:!0,closeable:!1,animate:!0,size:le.c.default,role:le.b.alertdialog,children:[Object(ee.jsxs)(je.g,{children:["LoboReader",Object(ee.jsx)("br",{}),"for Internet Archive"]}),Object(ee.jsx)(je.e,{className:"doubleSpace",children:Object(ee.jsxs)(pe.a,{children:[Object(ee.jsx)("p",{children:'LoboReader is an unofficial reader for the Internet Archive "Magazine Rack".'}),Object(ee.jsx)("p",{}),Object(ee.jsx)("p",{children:"You have to add it to your Home screen and launch it from the app icon:"}),Object(ee.jsxs)("ul",{children:[Object(ee.jsx)("li",{children:'When using Safari (iOS and iPadOS), tap the Share button and select "Add to Home Screen".'}),Object(ee.jsx)("li",{children:'When using Chrome (Android), tap the menu overflow button (three dots) and select "Add to Home screen".'})]})]})})]})},Oe=(n(127),Object(h.g)((function(e){var t=c.a.useState(!1),n=Object(j.a)(t,2),r=n[0],i=n[1];return window.matchMedia("(display-mode: standalone)").matches.isStandalone?Object(ee.jsx)(fe,{}):Object(ee.jsxs)(w.a,{placement:y.b.top,children:[Object(ee.jsxs)(b.a,{children:[Object(ee.jsx)("meta",{charSet:"utf-8"}),Object(ee.jsx)("title",{children:"LoboReader"}),Object(ee.jsx)("meta",{name:"viewport",content:"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"}),Object(ee.jsx)("meta",{name:"robots",content:"noindex"})]}),Object(ee.jsx)(he,{isOpen:r,onClose:function(){return i(!1)}}),Object(ee.jsxs)("div",{className:"anchored-top",children:[Object(ee.jsxs)(p.a,{overrides:{Root:{style:{height:"48px",width:"100%"}}},children:[Object(ee.jsx)(f.b,{$align:O.a.left,children:Object(ee.jsx)(f.a,{className:"header",children:Object(ee.jsx)("div",{children:"LoboReader"})})}),Object(ee.jsx)(f.b,{$align:O.a.center}),Object(ee.jsx)(f.b,{$align:O.a.right,children:Object(ee.jsx)(f.a,{children:Object(ee.jsx)(o.b,{to:"#",children:Object(ee.jsx)("div",{className:"header",style:{float:"right",marginRight:"16px",marginTop:"-4px",fontSize:"75%"},onClick:function(){return i((function(e){return!e}))},children:"About"})})})})]}),Object(ee.jsx)("div",{className:"menuBar",children:Object(ee.jsxs)(v.a,{mode:g.a.radio,initialState:{selected:0},children:[Object(ee.jsx)(o.c,{to:"/browse",isActive:function(e,t){if(e||"/"===t.pathname)return!0},activeClassName:"menuActive",children:Object(ee.jsx)(x.a,{kind:m.a.tertiary,children:"Browse"})}),Object(ee.jsx)(o.c,{to:"/collection",isActive:function(e,t){return e},activeClassName:"menuActive",children:Object(ee.jsx)(x.a,{kind:m.a.tertiary,children:"Collection"})})]})})]}),Object(ee.jsx)("div",{className:"container",children:Object(ee.jsxs)(h.c,{children:[Object(ee.jsx)(h.a,{exact:!0,path:"/",component:ae}),Object(ee.jsx)(h.a,{exact:!0,path:"/browse/s/:searchQuery",component:ae}),Object(ee.jsx)(h.a,{exact:!0,path:"/browse/:id",component:ae}),Object(ee.jsx)(h.a,{path:"/browse",component:ae}),Object(ee.jsx)(h.a,{exact:!0,path:"/collection",component:oe}),Object(ee.jsx)(h.a,{exact:!0,path:"/read/:id",component:ue}),Object(ee.jsx)(h.a,{exact:!0,path:"/read/:id/p/:prevAction",component:ue}),Object(ee.jsx)(h.a,{exact:!0,path:"/read/:id/p/:prevAction/:prevId",component:ue})]})})]})})));a.a.render(Object(ee.jsx)(u.Provider,{value:new s.a,children:Object(ee.jsx)(d.a,{theme:l.a,children:Object(ee.jsx)(o.a,{children:Object(ee.jsx)(Oe,{})})})}),document.getElementById("root"))}},[[129,1,2]]]);
//# sourceMappingURL=main.baa79df7.chunk.js.map