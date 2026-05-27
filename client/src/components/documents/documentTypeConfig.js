const DEFAULT_TYPE = "QUOTE";

const BASE_COPY = Object.freeze({
  createSubtitle: "Соберите документ и сохраните его в систему. После сохранения откроется карточка документа.",
  detailsSubtitle: "Редактируйте реквизиты и позиции документа, затем сохраните изменения.",
  sidebarHelper: "Проверьте реквизиты, даты и позиции перед сохранением.",
  statusHelper: "Статус показывает текущее состояние документа в жизненном цикле.",
  paymentHelper: "Оплата рассчитывается от итоговой суммы документа.",
  summaryTitle: "Итоги документа",
  summaryHint: "Сводка по текущим данным.",
  totalNetLabel: "Сумма без НДС",
  totalVatLabel: "НДС",
  totalGrossLabel: "Итого с НДС",
  itemsSubtitle: "Основная рабочая зона: позиции, количество, цена и НДС.",
});

export const DOCUMENT_TYPE_CONFIG = Object.freeze({
  QUOTE: Object.freeze({
    label: "Коммерческое предложение",
    shortLabel: "Предложение",
    category: "offer",
    sections: Object.freeze({
      validity: true,
      paymentTerms: false,
    }),
    capabilities: Object.freeze({
      requiresItems: true,
      supportsPayment: false,
    }),
    copy: Object.freeze({
      ...BASE_COPY,
      createSubtitle: "Сформируйте предложение для клиента и зафиксируйте срок действия условий.",
      detailsSubtitle: "Обновляйте позиции и срок действия предложения перед отправкой клиенту.",
      sidebarHelper: "Укажите период действия предложения, чтобы зафиксировать срок актуальности условий.",
      statusHelper: "Статус предложения показывает этап согласования с клиентом.",
      summaryHint: "Финансовая оценка текущего предложения.",
      totalGrossLabel: "Сумма предложения",
      itemsSubtitle: "Позиции предложения: номенклатура, стоимость и НДС.",
    }),
  }),
  ORDER: Object.freeze({
    label: "Заказ",
    shortLabel: "Заказ",
    category: "order",
    sections: Object.freeze({
      validity: true,
      paymentTerms: false,
    }),
    capabilities: Object.freeze({
      requiresItems: true,
      supportsPayment: false,
    }),
    copy: Object.freeze({
      ...BASE_COPY,
      createSubtitle: "Соберите заказ и зафиксируйте его условия перед дальнейшей обработкой.",
      detailsSubtitle: "Поддерживайте состав заказа и его условия в актуальном состоянии.",
      sidebarHelper: "При необходимости задайте период действия заказа.",
      statusHelper: "Статус заказа отражает этап обработки и исполнения.",
      summaryHint: "Итоги по позициям текущего заказа.",
      totalGrossLabel: "Сумма заказа",
      itemsSubtitle: "Позиции заказа: количество, цена и НДС по строкам.",
    }),
  }),
  INVOICE: Object.freeze({
    label: "Фактура",
    shortLabel: "Фактура",
    category: "billing",
    sections: Object.freeze({
      validity: false,
      paymentTerms: true,
    }),
    capabilities: Object.freeze({
      requiresItems: true,
      supportsPayment: true,
    }),
    copy: Object.freeze({
      ...BASE_COPY,
      createSubtitle: "Подготовьте платёжный документ с корректными реквизитами и сроком оплаты.",
      detailsSubtitle: "Редактируйте фактуру и держите условия оплаты в актуальном состоянии.",
      sidebarHelper: "Укажите дату оплаты или срок оплаты в днях.",
      statusHelper: "Статус фактуры отражает выставление и оплату документа.",
      paymentHelper: "Контролируйте оплату через оплачено, остаток и статус оплаты.",
      summaryHint: "Финансовая сумма к выставлению клиенту.",
      totalGrossLabel: "К оплате",
      itemsSubtitle: "Позиции фактуры: основание для расчёта суммы к оплате.",
    }),
  }),
  BILL: Object.freeze({
    label: "Счёт",
    shortLabel: "Счёт",
    category: "billing",
    sections: Object.freeze({
      validity: false,
      paymentTerms: true,
    }),
    capabilities: Object.freeze({
      requiresItems: true,
      supportsPayment: true,
    }),
    copy: Object.freeze({
      ...BASE_COPY,
      createSubtitle: "Сформируйте счёт и укажите условия оплаты для клиента.",
      detailsSubtitle: "Обновляйте счёт и контролируйте условия оплаты.",
      sidebarHelper: "Укажите дату оплаты или срок оплаты в днях.",
      statusHelper: "Статус счёта отражает этап выставления и факт оплаты.",
      paymentHelper: "Контролируйте оплату через оплачено, остаток и статус оплаты.",
      summaryHint: "Итоговая сумма счёта по позициям.",
      totalGrossLabel: "К оплате",
      itemsSubtitle: "Позиции счёта: количество, цена и НДС.",
    }),
  }),
  RECEIPT: Object.freeze({
    label: "Чек",
    shortLabel: "Чек",
    category: "receipt",
    sections: Object.freeze({
      validity: false,
      paymentTerms: false,
    }),
    capabilities: Object.freeze({
      requiresItems: true,
      supportsPayment: true,
    }),
    copy: Object.freeze({
      ...BASE_COPY,
      createSubtitle: "Соберите чек в упрощённом режиме без лишних полей.",
      detailsSubtitle: "Поддерживайте чек в компактном документном режиме.",
      sidebarHelper: "Чек использует упрощённый сценарий: главное — корректные позиции и суммы.",
      statusHelper: "Статус чека отражает базовый жизненный цикл продажи.",
      paymentHelper: "Для чека доступна упрощённая модель оплаты.",
      summaryHint: "Итоги по текущему чеку.",
      totalGrossLabel: "Сумма чека",
      itemsSubtitle: "Позиции чека: компактный и быстрый ввод строк.",
    }),
  }),
  CONTRACT: Object.freeze({
    label: "Договор",
    shortLabel: "Договор",
    category: "contract",
    sections: Object.freeze({
      validity: false,
      paymentTerms: false,
    }),
    capabilities: Object.freeze({
      requiresItems: false,
      supportsPayment: false,
    }),
    copy: Object.freeze({
      ...BASE_COPY,
      createSubtitle: "Сформируйте договорной документ. Позиции на этом этапе не обязательны.",
      detailsSubtitle: "Редактируйте договор; позиции можно добавить позже по мере уточнения условий.",
      sidebarHelper: "Для договора позиции не обязательны. Можно сохранить документ только с реквизитами и заметками.",
      statusHelper: "Статус договора отражает его юридическую стадию.",
      summaryHint: "Сводка договора. Если позиций нет, итоговые суммы останутся нулевыми.",
      totalGrossLabel: "Сумма договора",
      itemsSubtitle: "Позиции договора опциональны и могут быть добавлены позже.",
    }),
  }),
});

export const DOCUMENT_TYPES = Object.freeze(Object.keys(DOCUMENT_TYPE_CONFIG));

export const DEFAULT_DOCUMENT_TYPE = DEFAULT_TYPE;

export const DOCUMENT_TYPE_OPTIONS = Object.freeze(
  DOCUMENT_TYPES.map((type) => ({
    value: type,
    label: DOCUMENT_TYPE_CONFIG[type].label,
    shortLabel: DOCUMENT_TYPE_CONFIG[type].shortLabel,
  }))
);

export function getDocumentTypeConfig(type) {
  const normalized = String(type || "").trim().toUpperCase();
  return DOCUMENT_TYPE_CONFIG[normalized] || DOCUMENT_TYPE_CONFIG[DEFAULT_TYPE];
}
