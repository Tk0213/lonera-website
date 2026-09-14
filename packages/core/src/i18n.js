/**
 * Both languages, and the only t().
 *
 * Korean is not a translation layer bolted on the side here - it is half the
 * product, so a key that exists in one language and not the other is a bug
 * rather than a gap. `missingKeys()` exists so a test can say so.
 */

export const T={en:{
 plLogBooked:"Booked: {when}. We will remind you the day before.",plLogRequested:"Requested {when}. They confirm before it is booked.",plLogAsked:"Asked what times they have. Reply comes here.",
 wlJoin:"Join the line",wlAhead:"{n} ahead",wlYoureNth:"You are {n} in line",wlLeave:"leave",wlLeft:"Left the line",wlJoined:"You are {n} in line. We will take it if it frees up.",wlMax:"You can stand in {n} lines at once. Leave one first.",wlGotIt:"yours",wlOrdSuffix:"",wlClaimedTitle:"A time opened up",wlClaimedMsg:"{time} at {biz} was cancelled. It is yours.",
 previewNote:"Preview build. The businesses, ratings, reviews and times here are examples, not real Calgary listings.",
 avToday:"Today",avTomorrow:"Tomorrow",avNOpen:"{n} open",avNoneShort:"none",avSample:"Preview: these times are examples, not this business's real calendar.",avSampleWhy:"This business has not connected a calendar yet, so these times are examples.",
 whyOrder:"Why this order?",whyTitle:"Why you see this order",whySub:"Lonera puts things you have opened before nearer the front.",whyNone:"Nothing yet. Open a few listings and this rail starts matching what you look for.",whyHousing:"Rentals are never ordered by language. Housing has to be offered on the same terms to everyone.",whyLocal:"This is counted on your phone only. It is never sent to us and never sold.",whyReset:"Clear what Lonera remembers",whyCleared:"Cleared",done:"Done",
 plTitle:"Your errand",plSub:"{n} visits · {when} · {lang}",plAnyLang:"any language",plThisWeek:"this week",plSoon:"next opening",plLive:"live",plReqN:"to request",plAskN:"to ask",plSwap:"Swap",plWillAsk:"We will ask them for times",plNoMatch:"No {svc} on Lonera yet. We will still pass on your request.",plGoBook:"Book these times",plGoRequest:"Send all requests",plGoAsk:"Ask them all for times",plGoMixed:"Book the live times, request the rest",plAdjust:"Change something",plAdjustPh:"Say or type a change — \"drop the electrician\", \"make it Friday\"",plNone:"Name two or more services and I will line them up.",plUpdated:"Errand updated",plSwapped:"Switched to {n}",plSent:"Sent. You will hear back in this app.",plSentBooked:"All booked.",
 tabHome:"Home",tabBrowse:"Browse",tabSaved:"Saved",tabInbox:"Inbox",tabYou:"You",
 searchPh:"What do you need?",featuredNow:"Featured now",rowTrusted:"Trusted near you",rowToday:"Free today",rowJobs:"Jobs hiring now",rowMarket:"Buy and sell",rowGrocery:"Grocery deals",rowCommunity:"From the community",
 browseTitle:"Browse",browseSub:"Pick a category, or use the search bar below.",
 savedTitle:"Saved",inboxTitle:"Inbox",inboxSub:"Your requests, replies and updates.",youTitle:"You",
 emptySaved:"Nothing saved yet",emptySavedSub:"Tap the heart on any business and it lands here.",
 details:"See details",book:"Book a time",choose:"Choose this business",save:"Save",saved:"Saved",
 openNow:"Free today",
 askTitle:"What do you need?",askSub:"Say it however is easiest. We tidy up the wording, never the meaning.",
 askPh:"For example: I need my kitchen cleaned before Friday",
 aiTidied:"Tidied by Lonera",send:"Send to business",cancel:"Cancel",back:"Back",
 pickDay:"Pick a day",pickTime:"Pick a time",confirm:"Confirm booking",
 listening:"Listening. Speak now.",askVoice:"Ask with your voice",
 postJob:"Post a job",postItem:"Sell something",askCommunity:"Ask the community",getHelp:"Get help",
 jobTitle:"Job title",company:"Business name",pay:"Pay",area:"Area",itemName:"What are you selling?",price:"Price",
 question:"Your question",describe:"Describe it",post:"Post",submit:"Send",
 language:"Language",textSize:"Text size",
 runBiz:"I run a business",help:"Help and support",notif:"Notifications",
 tSaved:"Saved to your list",tSent:"Sent. The business will reply here.",tPosted:"Posted",tBooked:"Booking confirmed",
 tNoVoice:"Voice needs a microphone. Type it instead.",
 statusNew:"New",statusWait:"Waiting",statusOk:"Accepted",statusDone:"Resolved",
 compare:"Compare top 3",closeCmp:"Done",
 sizeS:"Normal",sizeL:"Large",sizeXL:"Extra large",
 tabCommunity:"Community",commTitle:"Community",
 commSub:"Groups run by neighbours. Join one, or start your own.",
 commGroups:"Groups near you",commBoard:"Questions and answers",
 join:"Join",joined:"Joined",members:"members",startComm:"Start a community",
 tJoined:"You joined. Say hello in the group.",
 tapSpeak:"Tap to speak",tapStop:"Stop listening",iService:"Service",iLang:"Language",iWhen:"When",iAction:"Action",
 aBook:"Book an appointment",aFind:"Find a business",aSell:"Sell something",
 aJob:"Find a job",aAsk:"Ask the community",
 nothingHeard:"Nothing to act on yet. Speak or type first.",
 segMsgs:"Messages",dayToday:"Today",segNotifs:"Notifications",
 delivered:"Delivered",composePh:"Message",
 reviewsTitle:"What people say",allReviews:"reviews", xsellTitle:"Other options nearby",alsoTitle:"Top rated nearby",recentTitle:"Recently viewed",autoReply:"Thanks, noted. I will confirm shortly.",
 noNotifs:"No notifications yet",noNotifsSub:"Replies and updates land here.",
 markRead:"Mark all read",unread:"new",
 verifTitle:"Verification",verifSub:"Badges show what has been checked, and by whom.",
 whoAmI:"Your account",verifyStep:"Verify",verifDone:"Done",
 vId:"ID verified",vBiz:"Business verified",vLic:"Licensed",vIns:"Insured",
 vPay:"Payment protected",vNew:"New member",vTop:"Top rated",vPhone:"Phone confirmed",
 vEmail:"Email confirmed",vAddr:"Address confirmed",
 notVerified:"Not verified yet",memberSince:"Member since",
 tVerified:"Sent for review. Most checks finish within a day.",
 bizTitle:"Business dashboard",backToApp:"Back to the app",
 visitsWeek:"Profile visits this week",vsLastWeek:"vs last week",
 statRequests:"New requests",statBooked:"Jobs booked",statPaid:"Paid out",
 chartTitle:"Visits per day",chartSub:"Last 7 days, Monday to Sunday",
 reqTitle:"People who asked for a job",invTitle:"Invoices",
 accept:"Accept",decline:"Decline",tAccepted:"Accepted. They have been told.",
 tDeclined:"Declined.",newInvoice:"Create an invoice",
 stPaid:"Paid",stSent:"Sent",stOverdue:"Overdue",stDraft:"Draft",
 visits:"visits",
 catAll:"listings",catOne:"listing",
 avLive:"Live times",avUsual:"Usual hours",avAsk:"Ask for times",
 avLiveWhy:"Straight from this business's own calendar. Updates when they book someone else.",
 avUsualWhy:"The hours this business gave us. Not live, so they confirm every request.",
 avAskWhy:"This business has not shared a schedule yet. Send a request and they will reply with times.",
 avTaken:"just taken",avNoneLeft:"No times left today",avPickTime:"Pick a time",
 avRequest:"Request a time",avAskThem:"Ask what times they have",
 avUpdated:"updated",avJustNow:"just now",catNone:"Nothing listed here yet",
 catNoneSub:"Try another category, or ask the community.",
 catGrocery:"Grocery deals",backBrowse:"All categories",
 vsListening:"Listening. Speak now.",vsPaused:"Tap the box and press enter",
 vsPh:"Say what you need",vsGo:"Show results",vsResults:"Best matches",
 vsNone:"Nothing matched. Try different words."
},ko:{
 plLogBooked:"{when} 예약 완료. 하루 전에 알려드립니다.",plLogRequested:"{when} 요청됨. 업체 확인 후 확정됩니다.",plLogAsked:"가능한 시간을 문의했습니다. 답변은 여기로 옵니다.",
 wlJoin:"대기 신청",wlAhead:"{n}명 대기",wlYoureNth:"대기 {n}번",wlLeave:"취소",wlLeft:"대기를 취소했습니다",wlJoined:"대기 {n}번입니다. 자리가 나면 잡아드립니다.",wlMax:"동시에 {n}개까지 대기할 수 있습니다. 하나를 취소해 주세요.",wlGotIt:"확정",wlOrdSuffix:"번째",wlClaimedTitle:"자리가 났습니다",wlClaimedMsg:"{biz} {time} 예약이 취소되어 회원님께 배정되었습니다.",
 previewNote:"미리보기 버전입니다. 여기 나오는 업체, 평점, 후기, 시간은 실제가 아닌 예시입니다.",
 avToday:"오늘",avTomorrow:"내일",avNOpen:"{n}개 가능",avNoneShort:"없음",avSample:"미리보기: 실제 캘린더가 아닌 예시 시간입니다.",avSampleWhy:"아직 캘린더가 연결되지 않아 예시 시간을 보여드립니다.",
 whyOrder:"이 순서의 이유",whyTitle:"이 순서로 보이는 이유",whySub:"이전에 열어 본 항목을 앞쪽에 보여 드립니다.",whyNone:"아직 기록이 없습니다. 몇 개를 열어 보시면 관심사에 맞춰 정렬됩니다.",whyHousing:"렌탈은 언어로 정렬하지 않습니다. 주거는 모두에게 동일한 조건으로 제공되어야 합니다.",whyLocal:"이 정보는 휴대폰에만 저장됩니다. 저희에게 전송되거나 판매되지 않습니다.",whyReset:"저장된 관심사 삭제",whyCleared:"삭제되었습니다",done:"완료",
 plTitle:"한 번에 처리",plSub:"방문 {n}건 · {when} · {lang}",plAnyLang:"언어 무관",plThisWeek:"이번 주",plSoon:"가장 빠른 시간",plLive:"실시간",plReqN:"요청 필요",plAskN:"문의 필요",plSwap:"변경",plWillAsk:"가능한 시간을 문의해 드립니다",plNoMatch:"아직 로네라에 {svc} 업체가 없습니다. 요청은 전달해 드립니다.",plGoBook:"이 시간으로 예약",plGoRequest:"전체 요청 보내기",plGoAsk:"전체 시간 문의하기",plGoMixed:"실시간은 예약, 나머지는 요청",plAdjust:"내용 변경",plAdjustPh:"변경 사항을 말하거나 입력하세요 — \"전기 빼줘\", \"금요일로\"",plNone:"서비스를 두 개 이상 말씀해 주세요.",plUpdated:"일정이 변경되었습니다",plSwapped:"{n}(으)로 변경했습니다",plSent:"전송되었습니다. 앱에서 답변을 받으실 수 있습니다.",plSentBooked:"모두 예약되었습니다.",
 tabHome:"홈",tabBrowse:"둘러보기",tabSaved:"저장됨",tabInbox:"받은함",tabYou:"내 정보",
 searchPh:"무엇이 필요하세요?",featuredNow:"지금 추천",rowTrusted:"믿을 수 있는 업체",rowToday:"오늘 가능",rowJobs:"지금 채용 중",rowMarket:"사고 팔기",rowGrocery:"장보기 할인",rowCommunity:"커뮤니티 소식",
 browseTitle:"둘러보기",browseSub:"카테고리를 고르시거나 아래 검색을 이용하세요.",
 savedTitle:"저장됨",inboxTitle:"받은함",inboxSub:"보내신 요청과 답변이에요.",youTitle:"내 정보",
 emptySaved:"저장한 항목이 없어요",emptySavedSub:"업체의 하트를 누르면 여기에 모여요.",
 details:"자세히 보기",book:"시간 예약",choose:"이 업체 선택",save:"저장",saved:"저장됨",
 openNow:"오늘 가능",
 askTitle:"무엇이 필요하세요?",askSub:"편하신 대로 말씀하세요. 표현만 다듬고 뜻은 그대로 전해요.",
 askPh:"예: 금요일 전에 주방 청소가 필요해요",
 aiTidied:"로네라가 다듬었어요",send:"업체에 보내기",cancel:"취소",back:"뒤로",
 pickDay:"날짜 선택",pickTime:"시간 선택",confirm:"예약 확정",
 listening:"듣고 있어요. 말씀해 주세요.",askVoice:"음성으로 물어보기",
 postJob:"채용 등록",postItem:"물건 팔기",askCommunity:"커뮤니티에 질문",getHelp:"도움 받기",
 jobTitle:"채용 제목",company:"업체명",pay:"급여",area:"지역",itemName:"무엇을 파시나요?",price:"가격",
 question:"질문 내용",describe:"설명",post:"등록",submit:"보내기",
 language:"언어",textSize:"글자 크기",
 runBiz:"업체를 운영해요",help:"도움말",notif:"알림",
 tSaved:"목록에 저장했어요",tSent:"보냈어요. 답변은 받은함에 표시돼요.",tPosted:"등록했어요",tBooked:"예약이 확정됐어요",
 tNoVoice:"음성은 마이크가 필요해요. 직접 입력해 주세요.",
 statusNew:"신규",statusWait:"대기 중",statusOk:"수락됨",statusDone:"해결됨",
 compare:"상위 3곳 비교",closeCmp:"완료",
 sizeS:"보통",sizeL:"크게",sizeXL:"아주 크게",
 tabCommunity:"커뮤니티",commTitle:"커뮤니티",
 commSub:"이웃들이 직접 만든 모임이에요. 가입하거나 새로 만들어 보세요.",
 commGroups:"가까운 모임",commBoard:"질문과 답변",
 join:"가입",joined:"가입함",members:"명",startComm:"모임 만들기",
 tJoined:"가입했어요. 모임에 인사해 보세요.",
 tapSpeak:"눌러서 말하기",tapStop:"그만 듣기",iService:"업종",iLang:"언어",iWhen:"언제",iAction:"할 일",
 aBook:"예약하기",aFind:"업체 찾기",aSell:"물건 팔기",
 aJob:"채용 찾기",aAsk:"커뮤니티에 질문",
 nothingHeard:"아직 실행할 내용이 없어요. 먼저 말하거나 입력해 주세요.",
 segMsgs:"메시지",dayToday:"오늘",segNotifs:"알림",
 delivered:"전달됨",composePh:"메시지",
 reviewsTitle:"이용 후기",allReviews:"개의 후기", xsellTitle:"근처 다른 선택지",alsoTitle:"근처 인기 업체",recentTitle:"최근 본 업체",autoReply:"확인했습니다. 곧 답변드릴게요.",
 noNotifs:"아직 알림이 없어요",noNotifsSub:"답변과 소식이 여기에 표시돼요.",
 markRead:"모두 읽음",unread:"새 소식",
 verifTitle:"인증",verifSub:"무엇이 확인되었는지 배지로 알 수 있어요.",
 whoAmI:"내 계정",verifyStep:"인증하기",verifDone:"완료",
 vId:"실명 인증",vBiz:"사업자 인증",vLic:"자격 보유",vIns:"보험 가입",
 vPay:"안전 결제",vNew:"신규 회원",vTop:"인기 업체",vPhone:"전화번호 확인",
 vEmail:"이메일 확인",vAddr:"주소 확인",
 notVerified:"아직 인증되지 않음",memberSince:"가입일",
 tVerified:"검토 요청을 보냈어요. 보통 하루 안에 끝나요.",
 bizTitle:"업체 대시보드",backToApp:"앱으로 돌아가기",
 visitsWeek:"이번 주 프로필 방문",vsLastWeek:"지난주 대비",
 statRequests:"새 요청",statBooked:"예약 확정",statPaid:"정산 완료",
 chartTitle:"일별 방문",chartSub:"최근 7일, 월요일부터 일요일까지",
 reqTitle:"작업을 요청한 사람",invTitle:"청구서",
 accept:"수락",decline:"거절",tAccepted:"수락했어요. 상대방에게 알렸어요.",
 tDeclined:"거절했어요.",newInvoice:"청구서 만들기",
 stPaid:"결제 완료",stSent:"발송됨",stOverdue:"연체",stDraft:"임시 저장",
 visits:"방문",
 catAll:"곳",catOne:"곳",
 avLive:"실시간 예약",avUsual:"평소 영업시간",avAsk:"시간 문의",
 avLiveWhy:"업체 캘린더에서 직접 가져옵니다. 다른 예약이 잡히면 바로 반영됩니다.",
 avUsualWhy:"업체가 알려준 영업시간이에요. 실시간이 아니라 매 요청을 업체가 확인합니다.",
 avAskWhy:"아직 일정을 공유하지 않은 업체예요. 요청을 보내면 가능한 시간을 알려드립니다.",
 avTaken:"방금 마감",avNoneLeft:"오늘 남은 시간이 없어요",avPickTime:"시간 선택",
 avRequest:"시간 요청하기",avAskThem:"가능한 시간 문의하기",
 avUpdated:"업데이트",avJustNow:"방금",catNone:"아직 등록된 곳이 없어요",
 catNoneSub:"다른 카테고리를 보시거나 커뮤니티에 물어보세요.",
 catGrocery:"장보기 할인",backBrowse:"전체 카테고리",
 vsListening:"듣고 있어요. 말씀해 주세요.",vsPaused:"입력 후 엔터를 눌러 주세요",
 vsPh:"필요한 것을 말씀하세요",vsGo:"결과 보기",vsResults:"가장 알맞은 곳",
 vsNone:"맞는 결과가 없어요. 다르게 말해 보세요."
}};
let lang="en", scale=1;
const t = k => T[lang][k];

/* ================= data (fictional demo) ================= */
/* f:1 = shown in the swipeable Featured rail. sc = which illustration to draw. */
const BIZ=[
 {id:"maple",av:"unknown",vb:["id","biz","pay"],lg:["Korean","English"],n:"Maple Grove Property Group",nk:"메이플 그로브 부동산",c:"Rentals",ck:"렌탈",p:"$800-1,800/mo",r:4.9,rv:38,a:"NW Calgary",g:"g5",sc:"home",v:1,e:1,free:1,f:1,
  d:"Furnished rooms and townhouses near downtown. Bilingual leasing agent.",dk:"다운타운 근처 가구 완비 방과 타운하우스. 한국어 상담 가능."},
 {id:"sparkle",av:"connected",vb:["id","biz"],lg:["English","Tagalog"],n:"Sparkle Home Services",nk:"스파클 홈 서비스",c:"Cleaning",ck:"청소",p:"$100-220",r:4.7,rv:21,a:"SE Calgary",g:"g3",sc:"clean",v:1,e:0,free:1,f:1,
  d:"Deep cleans and move-out cleans. Same-week booking most weeks.",dk:"딥 클리닝과 이사 청소. 대부분 당주 예약 가능."},
 {id:"bright",av:"unknown",vb:["id","biz","lic","pay"],lg:["Korean","English","Mandarin"],n:"Bright Path Immigration",nk:"브라이트패스 이민상담",c:"Immigration",ck:"이민",p:"$300-2,000",r:4.8,rv:52,a:"City-wide",g:"g1",sc:"doc",v:1,e:1,free:0,f:1,
  d:"Licensed consultant. Work permits and permanent residence.",dk:"공인 컨설턴트. 취업 비자 및 영주권 상담."},
 {id:"haneul",av:"declared",vb:["id","biz","top"],lg:["Korean","English"],n:"Studio Haneul Hair",nk:"스튜디오 하늘 헤어",c:"Hair",ck:"미용",p:"$30-120",r:4.9,rv:64,a:"Downtown",g:"g2",sc:"hair",v:1,e:0,free:1,f:1,
  d:"Cuts, perms and colour. Korean and English spoken.",dk:"커트, 펌, 염색. 한국어와 영어 가능."},
 {id:"north",av:"declared",vb:["id","lic"],lg:["English","Mandarin"],n:"Northstar Learning",nk:"노스스타 학습센터",c:"Tutoring",ck:"과외",p:"$30-60/hr",r:4.8,rv:29,a:"NW Calgary",g:"g6",sc:"book",v:1,e:0,free:0,
  d:"Math and English tutoring, grades 4 to 12.",dk:"4학년부터 12학년까지 수학과 영어 과외."},
 {id:"truebuild",av:"unknown",vb:["id","biz","lic","ins","pay"],lg:["English","Punjabi"],n:"TrueBuild Renovations",nk:"트루빌드 리노베이션",c:"Renovation",ck:"리노베이션",p:"$2,000+",r:4.9,rv:44,a:"City-wide",g:"g4",sc:"tools",v:1,e:1,free:1,f:1,
  d:"Basement development and additions. Red Seal certified.",dk:"지하실 개발 및 증축. 레드씰 자격 보유."},
 {id:"riverbend",av:"declared",vb:["id","biz","lic","pay"],lg:["English","Tagalog"],n:"Riverbend Dental",nk:"리버벤드 치과",c:"Dental",ck:"치과",p:"$120-900",r:4.8,rv:47,a:"SW Calgary",g:"g5",sc:"tooth",v:1,e:1,free:1,f:1,
  d:"Checkups, cleanings and emergency visits. Direct billing to most plans.",dk:"검진, 스케일링, 응급 진료. 대부분의 보험 직접 청구."},
 {id:"hometable",av:"unknown",vb:["id","biz","ins"],lg:["Korean","Tagalog"],n:"Home Table Catering",nk:"홈테이블 케이터링",c:"Catering",ck:"케이터링",p:"$14-28/person",r:4.9,rv:33,a:"City-wide",g:"g4",sc:"food",v:1,e:1,free:0,f:1,
  d:"Korean and Filipino party trays. Two days notice for large orders.",dk:"한식과 필리핀식 파티 트레이. 대량 주문은 이틀 전 예약."},
 {id:"aurora",av:"declared",vb:["id","biz","ins"],lg:["Punjabi","English"],n:"Aurora Auto Repair",nk:"오로라 자동차 정비",c:"Auto",ck:"정비",p:"$90-1,200",r:4.7,rv:58,a:"NE Calgary",g:"g6",sc:"car",v:1,e:0,free:1,
  d:"Brakes, tires and out-of-province inspections. Free shuttle.",dk:"브레이크, 타이어, 타주 차량 검사. 무료 셔틀 운행."},
 {id:"bowriver",av:"connected",vb:["id","biz","lic","top"],n:"Bow River Family Clinic",nk:"보우리버 가정의학과",c:"Clinic",ck:"의원",p:"Covered by AHCIP",r:4.9,rv:71,a:"NW Calgary",g:"g3",sc:"clinic",lg:["Korean","English"],v:1,e:0,free:1,f:1,
  d:"Family doctor, walk-ins and same-week appointments. Korean-speaking staff.",dk:"가정의학과, 워크인 및 당주 예약. 한국어 가능 직원 상주."},
 {id:"crescent",av:"declared",vb:["id","biz","ins"],lg:["English","Tagalog"],n:"Crescent Clean Co.",nk:"크레센트 클린",c:"Cleaning",ck:"청소",p:"$90-190",r:4.6,rv:34,a:"NW Calgary",g:"g3",sc:"clean2",v:1,e:0,free:1,
  d:"Recurring home cleans, weekly or biweekly. Same team each visit.",dk:"주 1회 또는 격주 정기 청소. 매번 같은 팀이 방문합니다."},
 {id:"bowness",av:"unknown",vb:["id","biz","pay"],lg:["English","Punjabi"],n:"Bowness Rentals",nk:"보네스 렌탈",c:"Rentals",ck:"렌탈",p:"$1,100-2,400/mo",r:4.6,rv:52,a:"NW Calgary",g:"g5",sc:"home2",v:1,e:1,free:0,
  d:"Whole houses and duplexes. Pets considered on most units.",dk:"단독주택과 듀플렉스. 대부분 반려동물 상담 가능."},
 {id:"nova",av:"declared",vb:["id","biz"],lg:["English","Mandarin"],n:"Nova Hair Studio",nk:"노바 헤어 스튜디오",c:"Hair",ck:"미용",p:"$45-160",r:4.7,rv:41,a:"SE Calgary",g:"g2",sc:"hair2",v:1,e:0,free:1,
  d:"Colour specialists. Consultation before every first appointment.",dk:"염색 전문. 첫 방문 전 항상 상담을 진행합니다."},
 {id:"elbow",av:"declared",vb:["id","biz","lic"],lg:["English","Korean"],n:"Elbow Park Dental",nk:"엘보파크 치과",c:"Dental",ck:"치과",p:"$110-850",r:4.7,rv:63,a:"SW Calgary",g:"g5",sc:"tooth2",v:1,e:1,free:0,
  d:"Evenings and Saturdays. Nervous patients welcome.",dk:"저녁과 토요일 진료. 치과가 무서운 분도 편하게 오세요."},
 {id:"prairie",av:"declared",vb:["id","lic"],lg:["English","Punjabi"],n:"Prairie Tutors",nk:"프레리 튜터스",c:"Tutoring",ck:"과외",p:"$28-55/hr",r:4.6,rv:37,a:"SE Calgary",g:"g6",sc:"book2",v:1,e:0,free:1,
  d:"Small group sessions, grades 6 to 12. Diploma exam prep.",dk:"6~12학년 소그룹 수업. 졸업 시험 대비."},
 {id:"chinook",av:"unknown",vb:["id","biz","lic","pay"],lg:["Mandarin","English"],n:"Chinook Tax and Bookkeeping",nk:"치눅 세무회계",c:"Taxes",ck:"세무",p:"$80-450",r:4.8,rv:41,a:"SE Calgary",g:"g3",sc:"work",v:1,e:1,free:0,
  d:"Personal and small business returns. First consultation is free.",dk:"개인 및 소상공인 세금 신고. 첫 상담 무료."},
 /* Plumbing and Electrical exist because the bundle feature is built around
    trades that get called together. Two Korean-speaking options per service,
    not one: with a single candidate per trade the planner is a lookup, not a
    ranking. */
 {id:"hanriver",av:"connected",vb:["id","biz","lic","ins"],lg:["Korean","English"],n:"Han River Plumbing",nk:"한강 배관",c:"Plumbing",ck:"배관",p:"$120-600",r:4.8,rv:37,a:"NW Calgary",g:"g5",sc:"tools",v:1,e:1,free:1,f:1,
  d:"Licensed plumber. Leaks, drains and water heaters, same-week most weeks.",dk:"면허 배관공. 누수, 배수, 온수기. 대부분 당주 방문 가능."},
 {id:"taeyang",av:"declared",vb:["id","biz","lic"],lg:["Korean","English"],n:"Taeyang Plumbing and Heating",nk:"태양 배관 난방",c:"Plumbing",ck:"배관",p:"$110-540",r:4.6,rv:22,a:"NE Calgary",g:"g1",sc:"tools",v:1,e:0,free:0,f:1,
  d:"Plumbing and furnace work. Korean-speaking owner does the estimate himself.",dk:"배관 및 보일러 수리. 한국어 가능한 사장님이 직접 견적."},
 {id:"mirae",av:"connected",vb:["id","biz","lic","ins"],lg:["Korean","English"],n:"Mirae Electric",nk:"미래 전기",c:"Electrical",ck:"전기",p:"$130-700",r:4.9,rv:29,a:"SW Calgary",g:"g6",sc:"tools",v:1,e:1,free:1,f:1,
  d:"Licensed electrician. Panels, outlets and lighting. Permits handled.",dk:"면허 전기공. 배전반, 콘센트, 조명. 허가 대행."},
 {id:"voltway",av:"declared",vb:["id","biz","lic"],lg:["English","Korean"],n:"Voltway Electrical",nk:"볼트웨이 전기",c:"Electrical",ck:"전기",p:"$125-650",r:4.5,rv:18,a:"City-wide",g:"g4",sc:"tools",v:1,e:0,free:0,f:0,
  d:"Residential rewiring and inspections. Evening visits available.",dk:"주택 배선 및 점검. 저녁 방문 가능."},
 {id:"sarang",av:"declared",vb:["id","biz","top"],lg:["Korean","English"],n:"Sarang Cleaning",nk:"사랑 청소",c:"Cleaning",ck:"청소",p:"$90-200",r:4.8,rv:44,a:"NW Calgary",g:"g3",sc:"clean2",v:1,e:0,free:0,f:1,
  d:"Korean-speaking team. Regular and move-out cleans across the northwest.",dk:"한국어 가능한 팀. 정기 청소 및 이사 청소, 북서부 지역."}
];
const CATS=[["Cleaning","청소","g3","clean"],["Rentals","렌탈","g5","home"],["Tutoring","과외","g6","book"],["Hair","미용","g2","hair"],
 ["Immigration","이민","g1","doc"],["Renovation","리노베이션","g4","tools"],["Dental","치과","g5","tooth"],["Catering","케이터링","g4","food"],
 ["Plumbing","배관","g5","tools"],["Electrical","전기","g6","tools"],["Auto","자동차","g1","car"],["Taxes","세무","g3","work"]];
const JOBS=[{n:"Kitchen prep cook",nk:"주방 프렙 쿡",c:"Home Table Catering",ck:"홈테이블 케이터링",p:"$19/hr",a:"City-wide",g:"g4",sc:"food"},
 {n:"Front desk assistant",nk:"프론트 데스크 보조",c:"Riverbend Dental",ck:"리버벤드 치과",p:"$21/hr",a:"SW Calgary",g:"g5",sc:"tooth"},
 {n:"Junior carpenter",nk:"주니어 목수",c:"TrueBuild",ck:"트루빌드",p:"$28-34/hr",a:"City-wide",g:"g1",sc:"tools"},
 {n:"Weekend cleaner",nk:"주말 청소 담당",c:"Sparkle Home Services",ck:"스파클 홈 서비스",p:"$22/hr",a:"SE Calgary",g:"g3",sc:"clean"}];
const MARKET=[{n:"IKEA dining table and 4 chairs",nk:"이케아 식탁과 의자 4개",p:"$120",a:"NW Calgary",cond:"Used",ck2:"중고",g:"g3",sc:"goods"},
 {n:"32 inch monitor, barely used",nk:"32인치 모니터, 거의 새것",p:"$90",a:"SE Calgary",cond:"Like new",ck2:"거의 새것",g:"g5",sc:"screen"},
 {n:"Rice cooker, still boxed",nk:"전기밥솥, 미개봉",p:"$65",a:"SW Calgary",cond:"New",ck2:"새 상품",g:"g4",sc:"food"},
 {n:"Toddler stroller, folds flat",nk:"유아 유모차, 접이식",p:"$75",a:"NE Calgary",cond:"Used",ck2:"중고",g:"g6",sc:"stroller"}];
const GROCERY=[{s:"Safeway",i:"Ground beef",ik:"다진 소고기",p:"$6.99/lb",sc:"beef"},
 {s:"No Frills",i:"Roma tomatoes",ik:"로마 토마토",p:"$0.99/lb",sc:"tomato"},
 {s:"Walmart",i:"Seedless watermelon",ik:"씨 없는 수박",p:"$4.98",sc:"melon"},
 {s:"Safeway",i:"Chicken breast",ik:"닭가슴살",p:"$6.88/lb",sc:"chicken"},
 {s:"No Frills",i:"Yellow onions, 3 lb bag",ik:"양파 3파운드",p:"$2.47",sc:"onion"}];
const COMMUNITY=[{q:"Where can I find a Korean-speaking dentist in NW?",qk:"NW에 한국어 되는 치과 있을까요?",r:6,tag:"Korean community",tk:"한인 커뮤니티"},
 {q:"Any Tagalog tutor for kids in SE Calgary?",qk:"SE 캘거리에 아이 타갈로그어 선생님 계신가요?",r:3,tag:"Filipino community",tk:"필리핀 커뮤니티"}];
/* neighbour-run groups: the Community tab */
const GROUPS=[
 {id:"soccer",n:"Sunday Soccer at Shouldice",nk:"셸다이스 일요일 축구",m:184,sc:"soccer",
  d:"Casual pickup, all levels. Sundays 2pm, bring a light and dark shirt.",dk:"편하게 하는 픽업 축구. 일요일 오후 2시, 밝은 옷과 어두운 옷 챙겨 오세요."},
 {id:"running",n:"Bow River Running Club",nk:"보우강 러닝 클럽",m:96,sc:"running",
  d:"5k and 10k along the pathway. Tuesday and Thursday mornings, 6:30am.",dk:"강변 5km, 10km 코스. 화요일과 목요일 아침 6시 30분."},
 {id:"hiking",n:"Rockies Day Hikes",nk:"로키 당일 하이킹",m:212,sc:"hiking",
  d:"Carpools to Kananaskis most Saturdays. Beginner routes posted weekly.",dk:"토요일마다 캐나내스키스 카풀. 초보 코스 매주 공지."},
 {id:"newcomers",n:"Calgary Newcomers Coffee",nk:"캘거리 신규 이민자 커피 모임",m:341,sc:"chat",
  d:"First Saturday of the month. Bring questions about settling in.",dk:"매달 첫째 토요일. 정착 관련 질문 무엇이든 환영."},
 {id:"church",n:"Korean Church Fellowship",nk:"한인 교회 친교 모임",m:158,sc:"church",
  d:"Sunday service and a shared lunch after. Everyone welcome.",dk:"주일 예배와 식사 교제. 누구나 환영합니다."},
 {id:"kitchen",n:"Filipino Home Cooks",nk:"필리핀 가정 요리 모임",m:127,sc:"food",
  d:"Recipe swaps and a monthly potluck in the community hall.",dk:"레시피 나눔과 매달 포트럭 모임."}
];
let JOINED=[];

/* ---- verification: one badge vocabulary used for people and businesses ---- */
const VERIF={
 id:  {k:"vId", i:"id",     c:"ok"},
 biz: {k:"vBiz",i:"brief",  c:"b"},
 lic: {k:"vLic",i:"shield", c:"b"},
 ins: {k:"vIns",i:"shield", c:"ok"},
 pay: {k:"vPay",i:"shield", c:"b"},
 new: {k:"vNew",i:"user",   c:"n"},
 top: {k:"vTop",i:"star",   c:"w"}
};

export const LANGS = [["en","English","English"],["ko","한국어","Korean"]];

/** Look up a key. Falls back to English, then to the key itself. */
export function translate(lang, key) {
  const table = T[lang] || T.en;
  const v = table[key];
  if (typeof v === "string") return v;
  const en = T.en[key];
  return typeof en === "string" ? en : key;
}

/** Bind a language once, so components call t("key") and nothing else. */
export const makeT = lang => key => translate(lang, key);

/** Keys present in one language but not the other, in both directions. */
export function missingKeys() {
  const en = Object.keys(T.en), ko = Object.keys(T.ko);
  return {
    missingInKo: en.filter(k => !(k in T.ko)),
    missingInEn: ko.filter(k => !(k in T.en)),
  };
}
