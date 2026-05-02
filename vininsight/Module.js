/**
 * Transport Monitoring Module - PILOT Extension
 * Мониторинг температурного режима транспортных средств с рефрижераторами
 *
 * Интеграция Flask backend с Pilot-GPS интерфейсом через Pilot Extensions
 */

Ext.define('Store.transport-monitoring.Module', {
    extend: 'Ext.Component',

    /**
     * Главная функция инициализации модуля
     * Вызывается автоматически при загрузке расширения в Pilot
     */
    initModule: function () {
        console.log('🚛 Transport Monitoring Module initialized');

        // 1. СОЗДАЕМ НАВИГАЦИОННУЮ ВКЛАДКУ
        var navTab = Ext.create('Store.transport-monitoring.Tab', {
            title: 'Мониторинг',
            iconCls: 'fa fa-truck',  // FontAwesome иконка грузовика
            tooltip: 'Мониторинг температурного режима транспорта'
        });

        // 2. СОЗДАЕМ ГЛАВНУЮ ПАНЕЛЬ ДАШБОРДА
        var dashboardPanel = Ext.create('Store.transport-monitoring.DashboardPanel', {
            title: 'Общая сводка',
            iconCls: 'fa fa-chart-line'
        });

        // 3. СОЗДАЕМ ПАНЕЛЬ ТРАНСПОРТНЫХ СРЕДСТВ
        var vehiclesPanel = Ext.create('Store.transport-monitoring.VehiclesPanel', {
            title: 'По ТС',
            iconCls: 'fa fa-truck-moving'
        });

        // 4. СОЗДАЕМ ПАНЕЛЬ КОНТРАГЕНТОВ
        var contractorsPanel = Ext.create('Store.transport-monitoring.ContractorsPanel', {
            title: 'По контрагентам',
            iconCls: 'fa fa-building'
        });

        // 5. СВЯЗЫВАЕМ КОМПОНЕНТЫ
        // Навигационная вкладка содержит ссылки на все панели
        navTab.map_frame = dashboardPanel;  // Панель по умолчанию
        navTab.vehiclesPanel = vehiclesPanel;
        navTab.contractorsPanel = contractorsPanel;

        // 6. ДОБАВЛЯЕМ КОМПОНЕНТЫ В ИНТЕРФЕЙС PILOT
        skeleton.navigation.add(navTab);           // Вкладка в левую навигацию
        skeleton.mapframe.add(dashboardPanel);    // Главная панель в основную область
        skeleton.mapframe.add(vehiclesPanel);     // Панель ТС в основную область
        skeleton.mapframe.add(contractorsPanel);  // Панель контрагентов в основную область

        // 7. ЗАГРУЖАЕМ СТИЛИ
        this.loadStyles();

        // 8. ЗАГРУЖАЕМ КОНФИГУРАЦИЮ
        this.loadConfig();

        // 9. ЗАПУСКАЕМ ПЕРИОДИЧЕСКОЕ ОБНОВЛЕНИЕ ДАННЫХ
        this.startDataRefresh();

        console.log('✅ Transport Monitoring Module loaded successfully!');
    },

    /**
     * Загрузка пользовательских CSS стилей
     */
    loadStyles: function () {
        var cssLink = document.createElement("link");
        cssLink.setAttribute("rel", "stylesheet");
        cssLink.setAttribute("type", "text/css");
        cssLink.setAttribute("href", '/store/transport-monitoring/style.css');
        document.head.appendChild(cssLink);
    },

    /**
     * Загрузка конфигурации из JSON файла
     */
    loadConfig: function () {
        Ext.Ajax.request({
            url: '/store/transport-monitoring/config.json',
            method: 'GET',
            success: function(response) {
                var config = Ext.JSON.decode(response.responseText);
                console.log('📋 Application config loaded:', config);

                // Сохраняем конфигурацию в глобальном объекте
                Store.transportMonitorConfig = config;

                // Применяем настройки
                if (config.settings && config.settings.refreshInterval) {
                    Store.transportMonitorConfig.refreshInterval = config.settings.refreshInterval;
                }
            },
            failure: function() {
                console.warn('⚠️ Could not load configuration file, using defaults');
                // Устанавливаем значения по умолчанию
                Store.transportMonitorConfig = {
                    appName: 'Transport Monitoring',
                    version: '1.0.0',
                    settings: {
                        refreshInterval: 60000,  // 1 минута по умолчанию
                        apiBaseUrl: '/api'
                    }
                };
            }
        });
    },

    /**
     * Запуск периодического обновления данных
     */
    startDataRefresh: function () {
        var refreshInterval = Store.transportMonitorConfig ?
            Store.transportMonitorConfig.settings.refreshInterval : 60000;

        console.log('🔄 Starting data refresh with interval:', refreshInterval, 'ms');

        // Запускаем обновление сразу
        this.refreshAllData();

        // Устанавливаем периодическое обновление
        this.refreshTimer = Ext.TaskManager.start({
            run: this.refreshAllData,
            interval: refreshInterval,
            scope: this
        });
    },

    /**
     * Обновление всех данных дашборда
     */
    refreshAllData: function () {
        console.log('🔄 Refreshing dashboard data...');

        // Обновляем главную панель дашборда
        var dashboardPanel = Ext.getCmp('transport-dashboard-panel');
        if (dashboardPanel && dashboardPanel.loadData) {
            dashboardPanel.loadData();
        }

        // Обновляем панель транспортных средств
        var vehiclesPanel = Ext.getCmp('transport-vehicles-panel');
        if (vehiclesPanel && vehiclesPanel.loadData) {
            vehiclesPanel.loadData();
        }

        // Обновляем панель контрагентов
        var contractorsPanel = Ext.getCmp('transport-contractors-panel');
        if (contractorsPanel && contractorsPanel.loadData) {
            contractorsPanel.loadData();
        }
    },

    /**
     * Остановка периодического обновления
     */
    stopDataRefresh: function () {
        if (this.refreshTimer) {
            Ext.TaskManager.stop(this.refreshTimer);
            console.log('⏹️ Data refresh stopped');
        }
    },

    /**
     * Получение данных из Flask backend
     * @param {string} endpoint - API endpoint
     * @param {function} callback - Callback функция для обработки данных
     * @param {function} errorCallback - Callback функция для обработки ошибок
     */
    getApiData: function (endpoint, callback, errorCallback) {
        var apiBaseUrl = Store.transportMonitorConfig ?
            Store.transportMonitorConfig.settings.apiBaseUrl : '/api';

        Ext.Ajax.request({
            url: apiBaseUrl + endpoint,
            method: 'GET',
            success: function(response) {
                try {
                    var data = Ext.JSON.decode(response.responseText);
                    if (callback) callback(data);
                } catch (e) {
                    console.error('❌ Error parsing API response:', e);
                    if (errorCallback) errorCallback(e);
                }
            },
            failure: function(response) {
                console.error('❌ API request failed:', response.status, response.statusText);
                if (errorCallback) errorCallback(response);
            }
        });
    },

    /**
     * Отправка данных во Flask backend
     * @param {string} endpoint - API endpoint
     * @param {object} data - Данные для отправки
     * @param {function} callback - Callback функция для обработки ответа
     * @param {function} errorCallback - Callback функция для обработки ошибок
     */
    postApiData: function (endpoint, data, callback, errorCallback) {
        var apiBaseUrl = Store.transportMonitorConfig ?
            Store.transportMonitorConfig.settings.apiBaseUrl : '/api';

        Ext.Ajax.request({
            url: apiBaseUrl + endpoint,
            method: 'POST',
            jsonData: data,
            success: function(response) {
                try {
                    var responseData = Ext.JSON.decode(response.responseText);
                    if (callback) callback(responseData);
                } catch (e) {
                    console.error('❌ Error parsing API response:', e);
                    if (errorCallback) errorCallback(e);
                }
            },
            failure: function(response) {
                console.error('❌ API request failed:', response.status, response.statusText);
                if (errorCallback) errorCallback(response);
            }
        });
    },

    /**
     * Показ уведомления пользователю
     * @param {string} title - Заголовок уведомления
     * @param {string} message - Текст уведомления
     * @param {string} icon - Иконка (info, warning, error, success)
     */
    showNotification: function (title, message, icon) {
        icon = icon || 'info';

        Ext.Msg.show({
            title: title,
            message: message,
            icon: icon,
            buttons: Ext.Msg.OK
        });
    },

    /**
     * Форматирование даты и времени
     * @param {string} dateString - Дата в формате ISO
     * @param {string} format - Формат даты (по умолчанию 'd.m.Y H:i')
     * @return {string} Отформатированная дата
     */
    formatDate: function (dateString, format) {
        format = format || 'd.m.Y H:i';
        try {
            var date = Ext.Date.parse(dateString, 'Y-m-d\\TH:i:s');
            return Ext.Date.format(date, format);
        } catch (e) {
            console.error('❌ Error formatting date:', dateString, e);
            return dateString;
        }
    },

    /**
     * Форматирование температуры
     * @param {number} temp - Температура
     * @return {string} Отформатированная температура
     */
    formatTemperature: function (temp) {
        if (temp === null || temp === undefined) {
            return 'N/A';
        }
        return temp.toFixed(1) + '°C';
    },

    /**
     * Получение цвета статуса температуры
     * @param {string} status - Статус (normal, low, high, range)
     * @return {string} CSS цвет
     */
    getStatusColor: function (status) {
        var colors = {
            'normal': '#28a745',    // Зеленый
            'low': '#17a2b8',       // Голубой
            'high': '#dc3545',      // Красный
            'range': '#ffc107'      // Желтый
        };
        return colors[status] || '#6c757d'; // Серый по умолчанию
    },

    /**
     * Получение текстового описания статуса
     * @param {string} status - Статус
     * @return {string} Текстовое описание
     */
    getStatusText: function (status) {
        var texts = {
            'normal': 'Норма',
            'low': 'Ниже нормы',
            'high': 'Выше нормы',
            'range': 'В диапазоне'
        };
        return texts[status] || status;
    },

    /**
     * Деструктор модуля
     * Вызывается при выгрузке расширения
     */
    destroy: function () {
        // Останавливаем таймер обновления
        this.stopDataRefresh();

        // Вызываем родительский деструктор
        this.callParent();
    }
});
