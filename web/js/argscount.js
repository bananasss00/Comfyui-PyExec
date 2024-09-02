import { app } from "../../../scripts/app.js";

app.registerExtension({
	name: "PyExec.js",

	async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if(!nodeData?.category?.startsWith("SP-Nodes")) {
			return;
		  }
        
		switch (nodeData.name) {
            case "PyExec_Output":
			case "PyExec":
                // sn = app.canvas.selected_nodes[Object.keys(app.canvas.selected_nodes)[0]]
                const originalOnNodeCreated = nodeType.prototype.onNodeCreated || function() {};

				nodeType.prototype.onNodeCreated = function () {
                    originalOnNodeCreated.apply(this, arguments);
                    
                    this._type = "*"
                    this.inputs_offset = nodeData.name.includes("selective")?1:0
                    this.outputs_offset = nodeData.name.includes("selective")?1:0

                    const updateArgs = () => {
                        const a_count = this.widgets.find(w => w.name === "args_count")["value"];

                        if (!this.inputs) {
                            this.inputs = [];
                        }
                        if(a_count!==this.inputs.length) {
                            if(a_count < this.inputs.length){
                                for(let i = this.inputs.length; i>=this.inputs_offset+a_count; i--)
                                        this.removeInput(i)
                            }
                            else{
                                for(let i = this.inputs.length+1-this.inputs_offset; i <= a_count; ++i)
                                    this.addInput(`a${i}`, this._type) 
                            }
                        }

                        if (!this.outputs) {
                            this.outputs = [];
                        }
                        if(a_count!==this.outputs.length) {
                            if(a_count < this.outputs.length){
                                for(let i = this.outputs.length; i>=this.outputs_offset+a_count; i--)
                                        this.removeOutput(i)
                            }
                            else{
                                for(let i = this.outputs.length+1-this.outputs_offset; i <= a_count; ++i)
                                    this.addOutput(`r${i}`, this._type, { shape: LiteGraph.ROUND_SHAPE }); // GRID_SHAPE

                                /*
                                //shapes are used for nodes but also for slots
                                BOX_SHAPE: 1,
                                ROUND_SHAPE: 2,
                                CIRCLE_SHAPE: 3,
                                CARD_SHAPE: 4,
                                ARROW_SHAPE: 5,
                                GRID_SHAPE: 6, // intended for slot arrays
                                */
                            }
                        }
                        
                        // Reset py widget y location
                        // const size = this.size;
                        this.widgets[0].y=0
                        // this.widgets[0].last_y=0
                        // this.setDirtyCanvas(true, false);
                        // this.setSize(this.computeSize());
                    }

                    this.addWidget("button", "Update args", null, () => {
                        updateArgs();
                    });

                    updateArgs();
				}
				break;
		}	
		
	}
});