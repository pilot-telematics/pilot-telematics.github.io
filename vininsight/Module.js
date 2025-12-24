/**
 * VIN Insight - PILOT Extension
 * 
 * Extension that enriches PILOT vehicle data with VIN decode information
 * from the auto.dev API.
 */

Ext.define('Store.vininsight.Module', {
    extend: 'Ext.Component',
    
    /**
     * Main initialization function called by PILOT
     */
    initModule: function () {
        var me = this;
        
        // Create the navigation tab (left panel)
        var navTab = Ext.create('Ext.panel.Panel', {
            title: 'VIN Insight',
            iconCls: 'fa fa-car',
            layout: 'fit',
            items: [{
                xtype: 'treepanel',
                title:'VIN Insight',
                tools:[{
                            xtype:'button',
                            iconCls: 'fa fa-rotate',
                            tooltip: l('Refresh'),
                            handler: function () {
                                this.up('treepanel').getStore().load();
                            }
                        }],
                rootVisible: false,
                useArrows: true,
                store: Ext.create('Ext.data.TreeStore', {
                    proxy: {
                        type: 'ajax',
                        url: '/ax/tree.php',
                        extraParams: {
                            vehs: 1,
                            state: 1
                        }
                    },
                    root: {
                        text: 'Root',
                        expanded: true
                    }
                 
                }),
                columns: [{
                    text: 'Vehicle',
                    xtype:'treecolumn',
                    dataIndex: 'name',
                    flex: 2
                }, {
                    text: 'VIN',
                    dataIndex: 'vin',
                    flex: 2
                }, {
                    text: 'Model',
                    dataIndex: 'model',
                    flex: 1
                }, {
                    text: 'Year',
                    dataIndex: 'year',
                    flex: 1
                }],
                listeners: {
                    selectionchange: function(tree, selected) {
                        if (selected.length > 0) {
                            var record = selected[0];
                            me.onVehicleSelect(record);
                        }
                    }
                }
            }]
        });
        
        // Create the main panel (right content area)
        var mainPanel = Ext.create('Ext.tab.Panel', {
            items: [{
                title: 'Overview',
                itemId: 'overviewTab',
                layout: 'fit',
                items: [{
                    xtype: 'panel',
                    padding: 10,
                    autoScroll: true,
                    html: '<div id="vin-overview-content"><p>Select a vehicle to see details</p></div>'
                }]
            }, {
                title: 'Raw Decode',
                itemId: 'rawTab',
                layout: 'fit',
                items: [{
                    xtype: 'panel',
                    padding: 10,
                    autoScroll: true,
                    html: '<div id="vin-raw-content"><p>No VIN decode data available</p></div>'
                }]
            }, {
                title: 'Settings',
                itemId: 'settingsTab',
                layout: {
                    type: 'vbox',
                    align: 'stretch'
                },
                items: [{
                    xtype: 'form',
                    padding: 20,
                    flex: 1,
                    items: [{
                        xtype: 'fieldset',
                        title: 'API Configuration',
                        padding: 10,
                        items: [{
                            xtype: 'textfield',
                            name: 'apiKey',
                            fieldLabel: 'API Key',
                            labelWidth: 100,
                            width: 400,
                            allowBlank: true,
                            emptyText: 'Enter your auto.dev API key',
                            value: localStorage.getItem('vininsight_apikey') || '',
                            listeners: {
                                change: function(field, newValue) {
                                    localStorage.setItem('vininsight_apikey', newValue);
                                }
                            }
                        }, {
                            xtype: 'displayfield',
                            value: '<a href="https://docs.auto.dev/v2/products/vin-decode" target="_blank">Get API key from auto.dev</a>',
                            fieldStyle: 'color: blue;'
                        }]
                    }, {
                        xtype: 'fieldset',
                        title: 'API Testing',
                        padding: 10,
                        items: [{
                            xtype: 'button',
                            text: 'Test API Connection',
                            margin: '10 0 0 0',
                            handler: function() {
                                me.testAPI();
                            }
                        }, {
                            xtype: 'displayfield',
                            value: 'Uses test VIN: 3GCUDHEL3NG668790',
                            fieldStyle: 'font-style: italic;'
                        }]
                    }],
                    buttons: [{
                        text: 'Save',
                        handler: function() {
                            var form = this.up('form');
                            var values = form.getValues();
                            localStorage.setItem('vininsight_apikey', values.apiKey || '');
                            Ext.Msg.alert('Success', 'API key saved to localStorage');
                        }
                    }, {
                        text: 'Clear',
                        handler: function() {
                            localStorage.removeItem('vininsight_apikey');
                            var form = this.up('form');
                            form.getForm().setValues({ apiKey: '' });
                            Ext.Msg.alert('Cleared', 'API key removed from localStorage');
                        }
                    }]
                }]
            }]
        });
        
        // Link navigation tab to main panel (CRITICAL RULE)
        navTab.map_frame = mainPanel;
        
        // Add to PILOT interface
        skeleton.navigation.add(navTab);
        skeleton.mapframe.add(mainPanel);
    },
    
    /**
     * Process hierarchical vehicle data from PILOT API
     */
    processVehicleData: function(store, records) {
        var vehicles = [];
        
        // Recursively extract vehicles from groups/folders
        var extractVehicles = function(nodes) {
            Ext.Array.forEach(nodes, function(node) {
                if (node.data.children) {
                    // This is a group/folder - process its children
                    extractVehicles(node.data.children);
                } else if (node.data.vehid) {
                    // This is a vehicle
                    vehicles.push({
                        text: node.data.name || 'Unknown',
                        name: node.data.name || 'Unknown',
                        vin: node.data.vin || '',
                        model: node.data.model || '',
                        year: node.data.year || '',
                        vehid: node.data.vehid,
                        leaf: true,
                        iconCls: 'fa fa-car'
                    });
                }
            });
        };
        
        extractVehicles(records);
        
        // Update the tree store with flat vehicle list
        store.setRoot({
            text: 'Vehicles',
            expanded: true,
            children: vehicles
        });
    },
    
    /**
     * Handle vehicle selection from tree
     */
    onVehicleSelect: function(record) {
        var me = this;
        var navTab = skeleton.navigation.items.items.find(function(item) {
            return item.title === 'VIN Insight';
        });
        
        if (!navTab || !navTab.map_frame) return;
        
        var mainPanel = navTab.map_frame;
        
        // Update overview tab
        var overviewTab = mainPanel.getComponent('overviewTab');
        var overviewContent = overviewTab.down('panel').body.dom.querySelector('#vin-overview-content');
        
        // Basic vehicle info
        var html = '<div class="vehicle-info">';
        html += '<h2>' + Ext.util.Format.htmlEncode(record.get('name')) + '</h2>';
        html += '<p><strong>VIN:</strong> ' + Ext.util.Format.htmlEncode(record.get('vin')) + '</p>';
        html += '<p><strong>Model:</strong> ' + Ext.util.Format.htmlEncode(record.get('model')) + '</p>';
        html += '<p><strong>Year:</strong> ' + Ext.util.Format.htmlEncode(record.get('year')) + '</p>';
        
        // Decode status section
        html += '<div id="decode-status">';
        html += '<p><strong>Decode Status:</strong> <span id="status-text">Not decoded</span></p>';
        html += '<button onclick="Ext.ComponentQuery.query(\'Store.vininsight.Module\')[0].decodeVIN(\'' + 
                Ext.util.Format.htmlEncode(record.get('vin')) + '\')">Decode VIN</button>';
        html += '</div>';
        
        // Decoded fields section (initially hidden)
        html += '<div id="decoded-fields" style="display:none; margin-top:20px;">';
        html += '<h3>Decoded Information</h3>';
        html += '<div id="decoded-content"></div>';
        html += '</div>';
        
        html += '</div>';
        
        overviewContent.innerHTML = html;
        
        // Clear raw decode tab
        var rawTab = mainPanel.getComponent('rawTab');
        var rawContent = rawTab.down('panel').body.dom.querySelector('#vin-raw-content');
        rawContent.innerHTML = '<p>No VIN decode data available</p>';
        
        // Switch to overview tab
        mainPanel.setActiveTab(overviewTab);
    },
    
    /**
     * Decode VIN using auto.dev API
     */
    decodeVIN: function(vin) {
        var me = this;
        
        if (!vin || vin.trim() === '') {
            Ext.Msg.alert('Error', 'VIN not specified');
            return;
        }
        
        var apiKey = localStorage.getItem('vininsight_apikey');
        if (!apiKey || apiKey.trim() === '') {
            Ext.Msg.alert('API Key Required', 
                'Please enter your auto.dev API key in the Settings tab first.');
            return;
        }
        
        // Update status
        var statusElement = document.getElementById('status-text');
        if (statusElement) {
            statusElement.innerHTML = '<span style="color: orange;">Decoding...</span>';
        }
        
        // Make API call via proxy
        Ext.Ajax.request({
            url: '/autodev/vin/' + encodeURIComponent(vin),
            params: {
                apiKey: apiKey
            },
            success: function(response) {
                try {
                    var data = Ext.decode(response.responseText);
                    me.displayDecodedData(vin, data);
                    
                    if (statusElement) {
                        statusElement.innerHTML = '<span style="color: green;">Decoded</span>';
                    }
                } catch (e) {
                    me.handleDecodeError('Failed to parse API response');
                }
            },
            failure: function(response) {
                me.handleDecodeError('API request failed: ' + (response.statusText || 'Unknown error'));
            }
        });
    },
    
    /**
     * Display decoded VIN data
     */
    displayDecodedData: function(vin, data) {
        var me = this;
        
        // Update overview tab with decoded fields
        var decodedContent = document.getElementById('decoded-content');
        var decodedFields = document.getElementById('decoded-fields');
        
        if (decodedContent && decodedFields) {
            decodedFields.style.display = 'block';
            
            var html = '<table class="decoded-table" style="width:100%; border-collapse:collapse;">';
            html += '<tr><th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Field</th>';
            html += '<th style="text-align:left; padding:8px; border-bottom:1px solid #ddd;">Value</th></tr>';
            
            // Add all fields from the response (according to auto.dev documentation)
            Ext.Object.each(data, function(key, value) {
                if (value && typeof value !== 'object') {
                    html += '<tr>';
                    html += '<td style="padding:8px; border-bottom:1px solid #eee;"><strong>' + 
                            Ext.util.Format.htmlEncode(key) + '</strong></td>';
                    html += '<td style="padding:8px; border-bottom:1px solid #eee;">' + 
                            Ext.util.Format.htmlEncode(value.toString()) + '</td>';
                    html += '</tr>';
                }
            });
            
            html += '</table>';
            decodedContent.innerHTML = html;
        }
        
        // Update raw decode tab with pretty JSON
        var navTab = skeleton.navigation.items.items.find(function(item) {
            return item.title === 'VIN Insight';
        });
        
        if (navTab && navTab.map_frame) {
            var mainPanel = navTab.map_frame;
            var rawTab = mainPanel.getComponent('rawTab');
            var rawContent = rawTab.down('panel').body.dom.querySelector('#vin-raw-content');
            
            var prettyJson = JSON.stringify(data, null, 2);
            rawContent.innerHTML = '<pre style="font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;">' + 
                                  Ext.util.Format.htmlEncode(prettyJson) + '</pre>';
        }
    },
    
    /**
     * Handle VIN decode errors
     */
    handleDecodeError: function(errorMessage) {
        var statusElement = document.getElementById('status-text');
        if (statusElement) {
            statusElement.innerHTML = '<span style="color: red;">Error: ' + errorMessage + '</span>';
        }
        
        Ext.Msg.alert('Decode Error', errorMessage);
    },
    
    /**
     * Test API connection with sample VIN
     */
    testAPI: function() {
        var me = this;
        var apiKey = localStorage.getItem('vininsight_apikey');
        
        if (!apiKey || apiKey.trim() === '') {
            Ext.Msg.alert('API Key Required', 
                'Please enter your auto.dev API key first.');
            return;
        }
        
        // Test with sample VIN from requirements
        var testVIN = '3GCUDHEL3NG668790';
        
        Ext.Msg.wait('Testing API connection with sample VIN...', 'Testing');
        
        Ext.Ajax.request({
            url: '/autodev/vin/' + encodeURIComponent(testVIN),
            params: {
                apiKey: apiKey
            },
            success: function(response) {
                Ext.Msg.hide();
                try {
                    var data = Ext.decode(response.responseText);
                    Ext.Msg.alert('API Test Successful', 
                        'API connection successful!<br><br>' +
                        'Sample VIN decoded successfully.<br>' +
                        'Vehicle: ' + (data.make || 'Unknown') + ' ' + (data.model || 'Unknown'));
                } catch (e) {
                    Ext.Msg.alert('API Test Failed', 
                        'Failed to parse API response. Check your API key.');
                }
            },
            failure: function(response) {
                Ext.Msg.hide();
                Ext.Msg.alert('API Test Failed', 
                    'API request failed. Please check:<br>' +
                    '1. Your API key is valid<br>' +
                    '2. You have access to VIN decode API<br>' +
                    '3. Network connectivity');
            }
        });
    }
});
