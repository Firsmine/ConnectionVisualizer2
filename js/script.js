const state = {
    nodes : [],
    edges : [],
    selectedNode: null,
    node: "NORMAL", // NORMAL, CONNECTING, PATHFINDING
    path: [],
    pan: { x: 0, y: 0 },
    zoom: 1,
    highlightedNodes: [],
    highlightedEdges: [],
}
// local storage
function saveData() {
  const data = {
    nodes: state.nodes,
    edges: state.edges,
  };
  localStorage.setItem("connectionVisualizer", JSON.stringify(data));
}
function loadData() {
  const data = localStorage.getItem("connectionVisualizer");
  if (data) {
    const parsed = JSON.parse(data);
    state.nodes = parsed.nodes || [];
    state.edges = parsed.edges || [];
  }
}

// event listeners
document.addEventListener("DOMContentLoaded", ()=>{
    const svgElement = document.getElementById("canvas");

    loadData()
    initNodeEvents(svgElement);
    initEdgeEvents();
    initPathfindingEvents();
    initPanZoomEvents(svgElement);
    initExportEvent();

    svgElement.addEventListener("click", (e)=>{
        const g = e.target.closest("g.node");
        if (g){
            if (g && state.node === "NORMAL"){
                state.selectedNode = g.getAttribute("data-id");
                state.highlightedNodes = [];
                state.highlightedEdges = [];
                render();
            }
        } else {
            state.selectedNode = null;
            state.node = "NORMAL";
            state.highlightedEdges = [];
            state.highlightedNodes = [];
            render();
        }
    });
    //delete
    document.getElementById("btnDelete").addEventListener("click", deleteSelectedNode);
    window.addEventListener("keydown", (e)=>{
        if (e.target.tagName === "INPUT") return;
        if (e.key === "Backspace" || e.key === "Delete"){
            deleteSelectedNode()
        }
    })
    // clear all
    document.getElementById("btnClear").addEventListener("click", ()=>{
        if (confirm("Clear all nodes?")){
            state.nodes = []
            state.edges = []
            state.selectedNode = null
            state.path = []
            state.node = "NORMAL"
            saveData()
            render()
        }
    })
    render()
    updateUI()
})

// save image
function initExportEvent(){
    document.getElementById("btnSave").addEventListener("click", ()=>{
        if (confirm("Save Image as SVG?")){
            const svg = document.getElementById("canvas");
            const serializer = new XMLSerializer();
            let source = serializer.serializeToString(svg)
            if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
                source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"',)
            }
            const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"})
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = "result.svg"
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
        }
    })
}

// pan zoom
function initPanZoomEvents(svgElement) {
  let isPanning = false;
  svgElement.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "svg" || e.target.tagName === "rect") {
      isPanning = true;
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (isPanning) {
      state.pan.x += e.movementX;
      state.pan.y += e.movementY;
      render();
    }
  });
  window.addEventListener("mouseup", () => {
    isPanning = false;
  });
  // zoom
  svgElement.addEventListener(
    "wheel",
    (e) => {
      const rect = svgElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // calculating cursor coords
      const svgX = (mouseX - state.pan.x) / state.zoom;
      const svgY = (mouseY - state.pan.y) / state.zoom;

      // change zoom amount
      const zoomAmount = 0.1;
      if (e.deltaY < 0) {
        state.zoom += zoomAmount;
      } else {
        state.zoom = Math.max(0.1, state.zoom - zoomAmount);
      }

      // zoom on cursor
      state.pan.x = mouseX - svgX * state.zoom;
      state.pan.y = mouseY - svgY * state.zoom;
      render();
    },
    { passive: false },
  );
}

// render
function render() {
  const layerNodes = document.getElementById("layerNodes");
  const layerEdges = document.getElementById("layerEdges");
  const workspace = document.getElementById("workspace");

  // update transform
  workspace.setAttribute(
    "transform",
    `translate(${state.pan.x}, ${state.pan.y}) scale(${state.zoom})`,
  );

  // clear canvas
  layerNodes.innerHTML = "";
  layerEdges.innerHTML = "";

  // render edges
  state.edges.forEach((edge) => {
    const nodeA = state.nodes.find((n) => String(n.id) === String(edge.from));
    const nodeB = state.nodes.find((n) => String(n.id) === String(edge.to));
    if (!nodeA || !nodeB) return;

    const isEdgeHighlighted = state.highlightedEdges.includes(String(edge.id));
    // const lineClass = isEdgeHighlighted
    //   ? "edge-line highlighted-edge"
    //   : "edge-line";

    const midX = (nodeA.x + nodeB.x) / 2;
    const midY = (nodeA.y + nodeB.y) / 2;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", nodeA.x);
    line.setAttribute("y1", nodeA.y);
    line.setAttribute("x2", nodeB.x);
    line.setAttribute("y2", nodeB.y);
    // line.setAttribute("class", lineClass);

    // if (isEdgeHighlighted) {
    //   line.style.stroke = "#007bff";
    //   line.style.strokeWidth = "4px";
    // } else {
    //   line.style.stroke = "#111";
    //   line.style.strokeWidth = "2px";
    // }
    line.setAttribute("stroke", isEdgeHighlighted ? "#007bff" : "#333333");
    line.setAttribute("stroke-width", isEdgeHighlighted ? "4" : "2");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", midX);
    text.setAttribute("y", midY - 5);
    text.setAttribute("text-anchor", "middle");
    text.style.fill = "#0033ff";
    text.style.fontSize = "12px";
    text.style.fontWeight = "bold";
    text.textContent = String(edge.distance);

    layerEdges.appendChild(line);
    layerEdges.appendChild(text);
  });

  // render nodes
  state.nodes.forEach((node) => {
    const nodeIdStr = String(node.id);
    const isSelected = String(state.selectedNode) === nodeIdStr;
    const isNodeHighlighted = state.highlightedNodes.includes(nodeIdStr);

    let gClass = "node";
    if (isSelected) gClass += " selected";
    if (isNodeHighlighted) gClass += " highlighted";

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", gClass);
    g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    g.setAttribute("data-id", node.id);

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("r", 35);
    circle.setAttribute("class", "node-circle");

    if (isNodeHighlighted) {
      circle.style.fill = "#fff";
      circle.style.stroke = "#0056b3";
    } else if (isSelected) {
      circle.style.fill = "#fff";
      circle.style.stroke = "#007bff";
    } else {
      circle.style.fill = "#ffffff";
      circle.style.stroke = "#333333";
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("class", "node-text");
    text.textContent = node.label;

    g.appendChild(circle);
    g.appendChild(text);
    layerNodes.appendChild(g);
  });
  updateUI();
}

function updateUI() {
  const btnConnect = document.getElementById("btnConnect");
  const btnDelete = document.getElementById("btnDelete");
  const btnPath = document.getElementById("btnPath");
  const statusLabel = document.getElementById("statusLabel");

  btnConnect.disabled = !state.selectedNode;
  btnDelete.disabled = !state.selectedNode;
  btnPath.disabled = !state.selectedNode;
  statusLabel.disabled = !state.selectedNode || state.nodes.length < 2;

  if (state.node === "CONNECTING" || state.node === "PATHFINDING") {
    statusLabel.classList.remove("status-hidden");
  } else {
    statusLabel.classList.add("status-hidden");
  }
}

// node logic
let draggedNodeId = null;
function initNodeEvents(svgElement) {
  const popupNode = document.getElementById("popupNode");
  const inputNodeName = document.getElementById("inputNodeName");
  const btnCreateNode = document.getElementById("btnCreateNode");
  const canvas = document.getElementById("canvas");
  let pendingCoords = null;

  svgElement.addEventListener("dblclick", (e) => {
    if (e.target.tagName !== "svg" && e.target.tagName !== "rect") return;

    const pt = svgElement.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const workspace = document.getElementById("workspace");
    const ctm = workspace.getScreenCTM();
    if (!ctm) return;
    const cursorPt = pt.matrixTransform(ctm.inverse());

    pendingCoords = { x: cursorPt.x, y: cursorPt.y };

    popupNode.style.left = e.clientX + 10 + "px";
    popupNode.style.top = e.clientY + 10 + "px";
    popupNode.classList.remove("hidden");
    inputNodeName.value = "";
    inputNodeName.focus();
  });
  const finalizeCreate = () => {
    const val = inputNodeName.value.trim();
    if (val && pendingCoords) {
      state.nodes.push({
        id: "n_" + Date.now(),
        label: val,
        x: pendingCoords.x,
        y: pendingCoords.y,
      });
      saveData();
      render();
    }
    popupNode.classList.add("hidden");
  };
  btnCreateNode.addEventListener("click", finalizeCreate);
  inputNodeName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finalizeCreate();
  });
  // drag logic
  svgElement.addEventListener("mousedown", (e) => {
    const g = e.target.closest("g.node");
    if (g) {
      draggedNodeId = g.getAttribute("data-id");
    }
  });
  window.addEventListener("mousemove", (e) => {
    if (draggedNodeId) {
      const node = state.nodes.find((n) => n.id === draggedNodeId);
      if (node) {
        // adjust movement
        node.x += e.movementX / state.zoom;
        node.y += e.movementY / state.zoom;
        render();
      }
    }
  });
  window.addEventListener("mouseup", () => {
    if (draggedNodeId) {
      draggedNodeId = null;
      saveData();
    }
  });
}
function deleteSelectedNode() {
  if (!state.selectedNode) return;
  if (confirm("Delete node and all of its connections?")) {
    state.nodes = state.nodes.filter(
      (node) => String(node.id) !== String(state.selectedNode),
    );
    state.edges = state.edges.filter(
      (edge) =>
        String(edge.from) !== String(state.selectedNode) &&
        String(edge.to) !== String(state.selectedNode),
    );
    state.selectedNode = null;
    state.highlightedNodes = [];
    state.highlightedEdges = [];
    saveData();
    render();
  }
}
// edge connection
function initEdgeEvents() {
  const btnConnect = document.getElementById("btnConnect");
  const popupEdge = document.getElementById("popupEdge");
  const inputDistance = document.getElementById("inputEdgeDistance");
  const btnCreateEdge = document.getElementById("btnCreateEdge");
  let targetNodeIdTemp = null;

  btnConnect.addEventListener("click", () => {
    state.node = "CONNECTING";
    render();
  });
  document.getElementById("canvas").addEventListener("click", (e) => {
    const g = e.target.closest("g.node");
    if (state.node === "CONNECTING" && g) {
      const targetId = g.getAttribute("data-id");
      if (targetId !== state.selectedNode) {
        const existingEdge = state.edges.find(
            e => (e.from === state.selectedNode && e.to === targetId) ||
                 (e.from === targetId && e.to === state.selectedNode)
        );
        if (existingEdge) {
            alert("There's already a connection between these nodes");
            return;
        }
        targetNodeIdTemp = targetId;
        popupEdge.style.left = e.clientX + 10 + "px";
        popupEdge.style.top = e.clientY + 10 + "px";
        popupEdge.classList.remove("hidden");
        inputDistance.value = "";
        inputDistance.focus();
      }
    }
  });
  const finalizeEdge = () => {
    const dist = parseFloat(inputDistance.value);
    console.log("Create edge:", { from: state.selectedNode, to: targetNodeIdTemp, dist });
    if (!isNaN(dist) && dist > 0 && targetNodeIdTemp && state.selectedNode) {
      state.edges.push({
        id: "e_" + Date.now(),
        from: state.selectedNode,
        to: targetNodeIdTemp,
        distance: dist,
      });
      saveData();
    } else {
        console.warn("Failed to make edge");
    }
    popupEdge.classList.add("hidden");
    state.node = "NORMAL";
    targetNodeIdTemp = null;
    state.selectedNode = null;
    render();
  };
  btnCreateEdge.addEventListener("click", finalizeEdge);
  inputDistance.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finalizeEdge();
  });
}

// dijkstra
function initPathfindingEvents() {
  const btnPath = document.getElementById("btnPath");

  btnPath.addEventListener("click", () => {
    state.node = "PATHFINDING";
    render();
  });

  document.getElementById("canvas").addEventListener("click", (e) => {
    const g = e.target.closest("g.node");
    if (state.node === "PATHFINDING" && g) {
      const targetId = g.getAttribute("data-id");
      if (targetId !== state.selectedNode) {
        findShortestPath(state.selectedNode, targetId);
        state.node = "NORMAL";
        render();
      }
    }
  });
}

function findShortestPath(startId, endId) {
  const start = String(startId);
  const end = String(endId);
  const distances = {};
  const prev = {};
  const unvisited = new Set();
  const adj = {};

  state.highlightedNodes = [];
  state.highlightedEdges = [];

  // build adjacency list
  state.nodes.forEach((n) => {
    const nodeIdStr = String(n.id);
    distances[nodeIdStr] = Infinity;
    adj[nodeIdStr] = [];
    unvisited.add(nodeIdStr);
  });
  if (distances[start] !== undefined){
      distances[start] = 0;
  } else {
    console.error("Start node not found");
    return;
  }

  state.edges.forEach((e) => {
    const fromStr = String(e.from);
    const toStr = String(e.to);
    if (adj[fromStr] && adj[toStr]) {
      adj[fromStr].push({
        node: toStr,
        weight: Number(e.distance),
        edgeId: String(e.id),
      });
      adj[toStr].push({
        node: fromStr,
        weight: Number(e.distance),
        edgeId: String(e.id),
      });
    }
  });
  while (unvisited.size > 0) {
    let currNode = null;
    let minDest = Infinity;
    unvisited.forEach((id) => {
      if (distances[id] < minDest) {
        minDest = distances[id];
        currNode = id;
      }
    });
    if (!currNode || distances[currNode] === Infinity) break;
    if (currNode === end) break;
    unvisited.delete(currNode);
    if (adj[currNode]){
        adj[currNode].forEach((neighbor) => {
          const alt = distances[currNode] + neighbor.weight;
          if (alt < distances[neighbor.node]) {
            distances[neighbor.node] = alt;
            prev[neighbor.node] = { id: currNode, edgeId: neighbor.edgeId };
          }
        });
    }
  }
  let curr = endId;
  if (distances[end] === Infinity){
    alert("No path found between these nodes")
    return;
  }
  if (prev[curr] !== undefined || start === end) {
    while (curr !== undefined && curr !== null) {
      state.highlightedNodes.push(curr);
      if (prev[curr]) {
        state.highlightedEdges.push(prev[curr].edgeId); // save edge id
        curr = prev[curr].id;
      } else {
        curr = null;
      }
    }
  }
  console.log("Path found", {
    nodes: state.highlightedNodes,
    edges: state.highlightedEdges
  });
}