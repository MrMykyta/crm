export const TASK_STATUS = ['todo','in_progress','done','blocked','canceled'];

function getCompanyMemberOptions(members = []){
  const list = Array.isArray(members) ? members : [];
  return list.map(m => ({
    value: m.userId || m.id,
    label: m.name || `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email || '—',
  }));
}

function toLocalInputDT(iso){ if(!iso) return ''; const d = new Date(iso); if(isNaN(d)) return ''; const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function fromLocalInputDT(s){ if(!s) return null; const d=new Date(s); return isNaN(d)?null:d.toISOString(); }

export function toFormTask(d={}){
  const assigneeIds = Array.isArray(d.userParticipants) ? d.userParticipants.filter(u=>u?.TaskUserParticipant?.role==='assignee').map(u=>u.id)
                     : Array.isArray(d.assigneeIds) ? d.assigneeIds : [];
  const watcherIds  = Array.isArray(d.userParticipants) ? d.userParticipants.filter(u=>u?.TaskUserParticipant?.role==='watcher').map(u=>u.id)
                     : Array.isArray(d.watcherIds) ? d.watcherIds : [];
  const departmentIds = Array.isArray(d.departmentParticipants) ? d.departmentParticipants.map(x=>x.id)
                        : Array.isArray(d.departmentIds) ? d.departmentIds : [];
  const contactIds = Array.isArray(d.contacts) ? d.contacts.map(c=>c.id)
                   : Array.isArray(d.contactIds) ? d.contactIds : [];

  return {
    id: d.id ?? null,
    title: d.title ?? '',
    category: d.category ?? '',
    description: d.description ?? '',
    creator: d.creator?.firstName + ' ' + d.creator.lastName || null,
    status: d.status ?? 'todo',
    priority: Number.isFinite(d.priority) ? d.priority : 50,
    startAt: toLocalInputDT(d.startAt),
    endAt: toLocalInputDT(d.endAt),
    timezone: d.timezone ?? Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? 'Europe/Warsaw',
    assigneeIds, watcherIds, departmentIds, contactIds,
    counterpartyId: d.counterpartyId ?? d.counterparty?.id ?? null,
    dealId: d.dealId ?? d.deal?.id ?? null,
    statusAggregate: !!d.statusAggregate,
  };
}

export function toApiTask(values={}){
  const hasAssignees = Array.isArray(values.assigneeIds) && values.assigneeIds.length>0;
  const hasDepartments = Array.isArray(values.departmentIds) && values.departmentIds.length>0;
  const hasWatchers = Array.isArray(values.watcherIds) && values.watcherIds.length>0;

  return {
    title: (values.title||'').trim(),
    category: values.category?.trim() || null,
    description: values.description?.trim() || null,
    status: TASK_STATUS.includes(values.status) ? values.status : 'todo',
    priority: Math.max(0, Math.min(100, parseInt(values.priority ?? 50,10) || 0)),
    startAt: fromLocalInputDT(values.startAt),
    endAt: fromLocalInputDT(values.endAt),
    timezone: values.timezone || null,
    participantMode: hasAssignees || hasDepartments ? 'lists' : 'none',
    watcherMode: hasWatchers ? 'lists' : 'none',
    assigneeIds: Array.isArray(values.assigneeIds) ? values.assigneeIds : [],
    departmentIds: Array.isArray(values.departmentIds) ? values.departmentIds : [],
    watcherIds: Array.isArray(values.watcherIds) ? values.watcherIds : [],
    contactIds: Array.isArray(values.contactIds) ? values.contactIds : [],
    counterpartyId: values.counterpartyId || null,
    dealId: values.dealId || null,
    statusAggregate: !!values.statusAggregate,
  };
}

export function buildTaskSchema(i18n, { members = [], currentUserId } = {}){
  const t = i18n?.t?.bind(i18n) ?? (x=>x);
  const memberOptions = getCompanyMemberOptions(members);
  const statusOptions = TASK_STATUS.map(v => ({ value:v, labelKey:`crm.task.enums.status.${v}` }));

  return [
    { kind:'section', title:'crm.task.sections.basic' },

    { name:'title', label:'crm.task.fields.title', type:'text', float:true, max:300, placeholder:'crm.task.placeholders.title', cols:4 },
    { name:'category', label:'crm.task.fields.category', type:'text', float:true, max:64, cols:2 },
    { name:'status',   label:'crm.task.fields.status',   type:'select', float:true,
      options: statusOptions.map(o=>({ value:o.value, labelKey:o.labelKey })), cols:2 },
    { name:'priority', label:'crm.task.fields.priority', type:'text', float:true, inputMode:'numeric', cols:2 },
    { name: 'creator', label:'crm.task.fields.creator', type:'text', float:true, cols:2 },

    { kind:'section', title:'crm.task.sections.schedule' },

    // Планирование — 4 ячейки в ряд; у нас 2 поля → занимаем по 2 колонки каждое
    { name:'startAt', label:'crm.task.fields.startAt', type:'datetime', float:true, cols:2 },
    { name:'endAt',   label:'crm.task.fields.endAt',   type:'datetime', float:true, cols:2 },

    { kind:'section', title:'crm.task.sections.participants' },

    { name:'assigneeIds', type:'dropdown-multiselect', float:true, cols:2,
      label:'crm.task.fields.assignees',
      options:()=>memberOptions, placeholder:'common.noneSelected',
      selectAllLabel:'common.selectAll', clearLabel:'common.clear', maxPreview:3 },

    { name:'watcherIds', type:'dropdown-multiselect', float:true, cols:2,
      label:'crm.task.fields.watchers',
      options:(values)=>{
        const me = currentUserId || null;
        const ass = new Set(values?.assigneeIds || []);
        return memberOptions.filter(o => !ass.has(o.value) && o.value !== me);
      },
      placeholder:'common.noneSelected', selectAllLabel:'common.selectAll',
      clearLabel:'common.clear', maxPreview:3 },
    
    { name:'counterpartyId', label:'crm.task.fields.counterparty', type:'select', float:true, options:[], cols:2 },
    { name:'contactIds', label:'crm.task.fields.contacts', type:'dropdown-multiselect', options:()=>[], float:true, cols:2 },

    { kind:'section', title:'crm.task.sections.links' },
    
    { name:'dealId',         label:'crm.task.fields.deal',         type:'select', float:true, options:[], cols:2 },

    { kind:'section', title:'crm.task.sections.logic' },
    { name:'statusAggregate', label:'crm.task.fields.statusAggregate', type:'checkbox', hint:'crm.task.hints.statusAggregate', cols:4 },
  ];
}
