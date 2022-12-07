const graph: GraphMap_T = new Map();

const UDependencyGraph = new class UDependencyGraph {
    public graph = graph;

    public addDependency(parent: UObject, child: UObject) {
        debugger;
    }
}();

export default UDependencyGraph;
export { UDependencyGraph };

type GraphMap_T = Map<UObject, GraphMap_T>;