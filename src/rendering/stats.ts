/**
 * @author mrdoob / http://mrdoob.com/
 */

export var Stats = function () {

    var mode = 0;

    var container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000';
    container.addEventListener('click', function (event) {

        event.preventDefault();
        showPanel(++mode % container.children.length);

    }, false);

    //

    function addPanel(panel) {

        container.appendChild(panel.dom);
        return panel;

    }

    function showPanel(id) {

        for (var i = 0; i < container.children.length; i++) {

            container.children[i].style.display = i === id ? 'block' : 'none';

        }

        mode = id;

    }

    //

    var beginTime = (performance || Date).now(), prevTime = beginTime, frames = 0;

    var fpsPanel = addPanel(new Stats.Panel('FPS', '#0ff', '#002'));
    var msPanel = addPanel(new Stats.Panel('MS', '#0f0', '#020'));

    if (self.performance && self.performance.memory) {

        var memPanel = addPanel(new Stats.Panel('MB', '#f08', '#201'));

    }

    showPanel(0);

    return {

        REVISION: 16,

        dom: container,

        addPanel: addPanel,
        showPanel: showPanel,

        begin: function () {

            beginTime = (performance || Date).now();

        },

        end: function () {

            frames++;

            var time = (performance || Date).now();

            msPanel.update(time - beginTime, 200);

            if (time >= prevTime + 1000) {

                fpsPanel.update((frames * 1000) / (time - prevTime), 100);

                prevTime = time;
                frames = 0;

                if (memPanel) {

                    var memory = performance.memory;
                    memPanel.update(memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576);

                }

            }

            return time;

        },

        update: function () {

            beginTime = this.end();

        },

        // Backwards Compatibility

        domElement: container,
        setMode: showPanel

    };

};

Stats.Panel = function (name, fg, bg) {

    var min = Infinity, max = 0, round = Math.round;

    var GRAPH_WIDTH = 74, GRAPH_HEIGHT = 30;

    var dom = document.createElement('div');
    dom.style.cssText = 'position:relative;width:80px;height:48px;background:' + bg;

    var text = document.createElement('div');
    text.style.cssText = 'position:absolute;left:3px;top:2px;font:bold 9px Helvetica,Arial,sans-serif;line-height:9px;white-space:nowrap;color:' + fg;
    text.textContent = name;

    var graph = document.createElement('div');
    graph.style.cssText = 'position:absolute;left:3px;top:15px;display:flex;width:' + GRAPH_WIDTH + 'px;height:' + GRAPH_HEIGHT + 'px;background:' + fg;

    for (var i = 0; i < GRAPH_WIDTH; i++) {

        var column = document.createElement('div');
        column.style.cssText = 'flex:0 0 1px;height:' + GRAPH_HEIGHT + 'px;background:' + bg + ';opacity:0.9';
        graph.appendChild(column);

    }

    dom.append(text, graph);

    return {

        dom: dom,

        update: function (value, maxValue) {

            min = Math.min(min, value);
            max = Math.max(max, value);

            text.textContent = round(value) + ' ' + name + ' (' + round(min) + '-' + round(max) + ')';

            var column = graph.firstChild;
            column.style.height = round((1 - (value / maxValue)) * GRAPH_HEIGHT) + 'px';
            graph.appendChild(column);

        }

    };

};

export default Stats;