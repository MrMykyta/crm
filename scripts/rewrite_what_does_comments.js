#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const FILES_CMD = `rg --files client/src server/src -g '*.{js,jsx,mjs,cjs}'`;
const LINE_RE = /^(\s*)\/\/\s*([^—:]+?)\s*(?:—.*)?$/;

function splitWords(name) {
  return String(name || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isPascal(name) {
  return /^[A-Z][A-Za-z0-9_$]*$/.test(name);
}

function getPathKind(filePath) {
  const p = filePath.replace(/\\/g, '/');
  if (p.includes('/hooks/')) return 'hook';
  if (p.includes('/components/')) return 'component';
  if (p.includes('/pages/')) return 'page';
  if (p.includes('/store/rtk/')) return 'rtk';
  if (p.includes('/controllers/')) return 'controller';
  if (p.includes('/services/')) return 'service';
  if (p.includes('/routes/')) return 'route';
  if (p.includes('/middleware/')) return 'middleware';
  if (p.includes('/models/')) return 'model';
  if (p.includes('/schemas/')) return 'schema';
  if (p.includes('/socket/')) return 'socket';
  if (p.includes('/utils/')) return 'util';
  return 'generic';
}

function startsWithWord(name, word) {
  const re = new RegExp(`^${word}(?:[A-Z_]|$)`, 'i');
  return re.test(String(name || ''));
}

function inferAction(name) {
  if (!name) return 'вспомогательная логика';

  const exact = {
    query: 'формирует параметры HTTP-запроса',
    endpoints: 'описывает endpoint-ы API-среза',
    transformResponse: 'нормализует ответ API перед использованием',
    providesTags: 'возвращает теги кэша для RTK Query',
    invalidatesTags: 'инвалидирует связанные теги кэша',
    onQueryStarted: 'обрабатывает сайд-эффекты при запуске запроса/мутации',
    reducer: 'обновляет состояние стора',
    middleware: 'перехватывает запрос и применяет правила обработки',
    exports: 'экспортирует публичный API модуля',
  };
  if (exact[name]) return exact[name];

  const rules = [
    ['get', 'возвращает данные'],
    ['list', 'возвращает список данных'],
    ['fetch', 'запрашивает данные'],
    ['load', 'загружает данные'],
    ['create', 'создаёт сущность'],
    ['add', 'добавляет сущность'],
    ['update', 'обновляет данные'],
    ['save', 'сохраняет данные'],
    ['remove', 'удаляет сущность'],
    ['delete', 'удаляет сущность'],
    ['build', 'собирает итоговую структуру данных'],
    ['normalize', 'нормализует входные/выходные данные'],
    ['format', 'форматирует данные для отображения'],
    ['parse', 'разбирает входные данные'],
    ['validate', 'проверяет корректность данных'],
    ['map', 'преобразует данные в нужный формат'],
    ['render', 'рендерит UI-блок'],
    ['handle', 'обрабатывает пользовательское действие'],
    ['open', 'открывает UI-элемент'],
    ['close', 'закрывает UI-элемент'],
    ['toggle', 'переключает состояние'],
    ['set', 'изменяет значение состояния'],
    ['use', 'инкапсулирует переиспользуемую логику'],
    ['is', 'проверяет условие'],
    ['has', 'проверяет наличие данных'],
    ['can', 'проверяет доступность действия'],
    ['should', 'определяет, нужно ли выполнять действие'],
    ['emit', 'отправляет событие в сокет/шину'],
  ];

  for (const [prefix, text] of rules) {
    if (startsWithWord(name, prefix)) return text;
  }

  return 'вспомогательная логика модуля';
}

function buildDescription(name, filePath) {
  const kind = getPathKind(filePath);
  const action = inferAction(name);
  const scenario = splitWords(name);

  if (kind === 'hook' && startsWithWord(name, 'use')) {
    return `Хук ${name}: ${action} и возвращает состояние/обработчики для компонентов.`;
  }

  if (kind === 'component' || kind === 'page') {
    if (isPascal(name)) {
      return `Компонент ${name}: отвечает за отображение UI и обработку взаимодействий пользователя.`;
    }
      return `${name}: ${action} в рамках UI-компонента.`;
  }

  if (kind === 'rtk') {
    const special = {
      query: 'query: формирует параметры HTTP-запроса для endpoint.',
      endpoints: 'endpoints: описывает набор endpoint-ов API-среза.',
      transformResponse: 'transformResponse: нормализует ответ API перед сохранением в кэш.',
      providesTags: 'providesTags: возвращает теги кэша для автоматического обновления данных.',
      invalidatesTags: 'invalidatesTags: помечает теги кэша для перезапроса связанных данных.',
      onQueryStarted: 'onQueryStarted: запускает побочные эффекты в жизненном цикле запроса.',
    };
    if (special[name]) return special[name];
    return `${name}: ${action} для слоя RTK Query.`;
  }

  if (kind === 'controller') {
    return `${name}: обрабатывает запрос контроллера и формирует ответ.`;
  }
  if (kind === 'service') {
    return `${name}: ${action} в сервисном слое бизнес-логики.`;
  }
  if (kind === 'route') {
    return `${name}: настраивает маршрут и связывает его с обработчиком.`;
  }
  if (kind === 'middleware') {
    return `${name}: обрабатывает запрос на промежуточном слое.`;
  }
  if (kind === 'model') {
    return `${name}: описывает поведение модели и работу с данными.`;
  }
  if (kind === 'schema') {
    return `${name}: описывает структуру и правила валидации данных.`;
  }
  if (kind === 'socket') {
    return `${name}: ${action} в сокет-слое реального времени.`;
  }
  if (kind === 'util') {
    return `${name}: ${action}.`;
  }

  if (name === 'exports') {
    return 'Экспорт модуля: публикует публичные функции и настройки.';
  }

  return `${name}: ${action}.`;
}

function processFile(filePath) {
  const abs = path.join(ROOT, filePath);
  const source = fs.readFileSync(abs, 'utf8');
  const lines = source.split(/\r?\n/);
  let changed = 0;

  const next = lines.map((line) => {
    const m = line.match(LINE_RE);
    if (!m) return line;
    const indent = m[1] || '';
    const fnName = String(m[2] || '').trim();
    const text = buildDescription(fnName, filePath);
    changed += 1;
    return `${indent}// ${text}`;
  });

  if (changed > 0 && !DRY_RUN) {
    fs.writeFileSync(abs, `${next.join('\n')}\n`, 'utf8');
  }

  return changed;
}

function main() {
  const fileListRaw = cp.execSync(FILES_CMD, { encoding: 'utf8' });
  const files = fileListRaw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((f) => !f.includes('/node_modules/') && !f.includes('/build/'));

  let scanned = 0;
  let changedFiles = 0;
  let replaced = 0;

  for (const file of files) {
    scanned += 1;
    const count = processFile(file);
    if (count > 0) {
      changedFiles += 1;
      replaced += count;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? 'dry-run' : 'write',
        scanned,
        changedFiles,
        replaced,
      },
      null,
      2
    )
  );
}

main();
