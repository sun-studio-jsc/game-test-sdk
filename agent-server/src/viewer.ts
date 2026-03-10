export function getViewerHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent - Semantic Snapshot Viewer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
            background: #0d1117;
            color: #c9d1d9;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid #21262d;
        }
        h1 {
            font-size: 18px;
            color: #58a6ff;
            font-weight: 600;
        }
        .status {
            display: flex;
            gap: 16px;
            font-size: 13px;
        }
        .status-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #484f58;
        }
        .dot.active { background: #3fb950; }
        .dot.stale { background: #d29922; }
        .dot.inactive { background: #f85149; }
        .meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }
        .meta-card {
            background: #161b22;
            border: 1px solid #21262d;
            border-radius: 6px;
            padding: 12px;
        }
        .meta-label {
            font-size: 11px;
            color: #8b949e;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .meta-value {
            font-size: 16px;
            color: #f0f6fc;
        }
        .controls {
            display: flex;
            gap: 8px;
            margin-bottom: 16px;
        }
        button {
            background: #21262d;
            color: #c9d1d9;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 6px 14px;
            cursor: pointer;
            font-size: 13px;
            font-family: inherit;
        }
        button:hover { background: #30363d; }
        button.active {
            background: #1f6feb;
            border-color: #1f6feb;
            color: #fff;
        }
        .tabs {
            display: flex;
            gap: 0;
            margin-bottom: 0;
            border-bottom: 1px solid #21262d;
        }
        .tab {
            padding: 8px 16px;
            cursor: pointer;
            font-size: 13px;
            color: #8b949e;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
        }
        .tab:hover { color: #c9d1d9; }
        .tab.active {
            color: #f0f6fc;
            border-bottom-color: #f78166;
        }
        .panel {
            display: none;
            background: #161b22;
            border: 1px solid #21262d;
            border-top: none;
            border-radius: 0 0 6px 6px;
            overflow: auto;
            max-height: calc(100vh - 320px);
        }
        .panel.active { display: block; }
        pre {
            padding: 16px;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .node-tree {
            padding: 12px;
        }
        .node-item {
            border: 1px solid #21262d;
            border-radius: 6px;
            margin-bottom: 8px;
            overflow: hidden;
        }
        .node-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #0d1117;
            cursor: pointer;
        }
        .node-header:hover { background: #161b22; }
        .node-role {
            background: #1f6feb;
            color: #fff;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }
        .node-role.button { background: #3fb950; }
        .node-role.text { background: #a371f7; }
        .node-role.image { background: #d29922; }
        .node-role.panel { background: #8b949e; }
        .node-role.entity { background: #f85149; }
        .node-id {
            color: #58a6ff;
            font-size: 13px;
        }
        .node-label {
            color: #f0f6fc;
            font-size: 13px;
            margin-left: auto;
        }
        .node-interactable {
            font-size: 11px;
            color: #3fb950;
            border: 1px solid #238636;
            padding: 1px 6px;
            border-radius: 10px;
        }
        .node-bounds {
            font-size: 11px;
            color: #8b949e;
        }
        .node-children {
            padding: 8px 8px 8px 24px;
        }
        .no-data {
            text-align: center;
            padding: 60px 20px;
            color: #484f58;
        }
        .no-data h2 {
            font-size: 16px;
            margin-bottom: 8px;
            color: #8b949e;
        }
        .no-data p { font-size: 13px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>AI Semantic Snapshot Viewer</h1>
        <div class="status">
            <div class="status-item">
                <div class="dot" id="statusDot"></div>
                <span id="statusText">Waiting for data...</span>
            </div>
        </div>
    </div>

    <div class="meta" id="meta" style="display:none">
        <div class="meta-card">
            <div class="meta-label">Scenes</div>
            <div class="meta-value" id="metaScenes">-</div>
        </div>
        <div class="meta-card">
            <div class="meta-label">Resolution</div>
            <div class="meta-value" id="metaResolution">-</div>
        </div>
        <div class="meta-card">
            <div class="meta-label">Total Nodes</div>
            <div class="meta-value" id="metaNodes">0</div>
        </div>
        <div class="meta-card">
            <div class="meta-label">Last Update</div>
            <div class="meta-value" id="metaTime">-</div>
        </div>
    </div>

    <div class="controls">
        <button id="btnAutoRefresh" class="active" onclick="toggleAutoRefresh()">Auto-Refresh: ON</button>
        <button onclick="fetchSnapshot()">Refresh Now</button>
    </div>

    <div class="tabs">
        <div class="tab active" onclick="switchTab('tree', this)">Node Tree</div>
        <div class="tab" onclick="switchTab('json', this)">Raw JSON</div>
    </div>

    <div class="panel active" id="panel-tree">
        <div class="node-tree" id="nodeTree">
            <div class="no-data">
                <h2>No snapshot data yet</h2>
                <p>Start the Phaser game with the AISemanticPlugin enabled.<br>
                The plugin will POST snapshots to this server automatically.</p>
            </div>
        </div>
    </div>

    <div class="panel" id="panel-json">
        <pre id="jsonOutput">Waiting for data...</pre>
    </div>

    <script>
        let autoRefresh = true;
        let refreshInterval;
        let lastData = null;

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            const btn = document.getElementById('btnAutoRefresh');
            btn.textContent = 'Auto-Refresh: ' + (autoRefresh ? 'ON' : 'OFF');
            btn.classList.toggle('active', autoRefresh);
            if (autoRefresh) startAutoRefresh();
            else stopAutoRefresh();
        }

        function startAutoRefresh() {
            stopAutoRefresh();
            refreshInterval = setInterval(fetchSnapshot, 500);
        }

        function stopAutoRefresh() {
            if (refreshInterval) clearInterval(refreshInterval);
        }

        function switchTab(name, el) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            el.classList.add('active');
            document.getElementById('panel-' + name).classList.add('active');
        }

        async function fetchSnapshot() {
            try {
                const res = await fetch('/snapshot');
                const data = await res.json();

                if (!data || (!data.nodes && !data.timestamp)) {
                    updateStatus('inactive', 'No data');
                    return;
                }

                lastData = data;
                updateStatus('active', 'Receiving');
                document.getElementById('meta').style.display = 'grid';

                document.getElementById('metaScenes').textContent = data.scenes?.join(', ') || '-';
                document.getElementById('metaResolution').textContent = data.resolution ? data.resolution[0] + ' x ' + data.resolution[1] : '-';
                document.getElementById('metaNodes').textContent = countNodes(data.nodes || []);
                document.getElementById('metaTime').textContent = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '-';

                document.getElementById('jsonOutput').textContent = JSON.stringify(data, null, 2);
                document.getElementById('nodeTree').innerHTML = renderNodes(data.nodes || []);

                if (data.nodes?.length === 0) {
                    document.getElementById('nodeTree').innerHTML =
                        '<div class="no-data"><h2>Snapshot received but no semantic nodes</h2>' +
                        '<p>Tag your Game Objects with semantic data:<br>' +
                        '<code>gameObject.setData("role", "button")</code></p></div>';
                }
            } catch (e) {
                updateStatus('inactive', 'Server offline');
            }
        }

        function updateStatus(state, text) {
            const dot = document.getElementById('statusDot');
            dot.className = 'dot ' + state;
            document.getElementById('statusText').textContent = text;
        }

        function countNodes(nodes) {
            let c = 0;
            for (const n of nodes) {
                c++;
                if (n.children?.length) c += countNodes(n.children);
            }
            return c;
        }

        function renderNodes(nodes) {
            if (!nodes.length) return '';
            let html = '';
            for (const node of nodes) {
                const roleClass = ['button','text','image','panel','entity'].includes(node.role) ? node.role : '';
                html += '<div class="node-item">';
                html += '<div class="node-header">';
                html += '<span class="node-role ' + roleClass + '">' + esc(node.role) + '</span>';
                html += '<span class="node-id">' + esc(node.id) + '</span>';
                if (node.interactable) html += '<span class="node-interactable">interactable</span>';
                if (node.label) html += '<span class="node-label">"' + esc(node.label) + '"</span>';
                html += '<span class="node-bounds">[' + (node.bounds || []).join(', ') + ']</span>';
                html += '</div>';
                if (node.state && Object.keys(node.state).length > 0) {
                    html += '<div style="padding:4px 12px;font-size:12px;color:#8b949e">state: ' + esc(JSON.stringify(node.state)) + '</div>';
                }
                if (node.children?.length) {
                    html += '<div class="node-children">' + renderNodes(node.children) + '</div>';
                }
                html += '</div>';
            }
            return html;
        }

        function esc(s) {
            if (!s) return '';
            return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        startAutoRefresh();
        fetchSnapshot();
    </script>
</body>
</html>`
}
