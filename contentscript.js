
function sendMessage (messagePayload, messageHandler){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, messagePayload, messageHandler);
    });
}
function handleServerError(request,status,error,stage){
    var message = "An error occurred during " + stage+".\n"+
        "The server responded with status code '"+status+"' and the error message was:\n'"+error+"'";
    rdfazerMessage(message,"bad-message");
}

function rdfazerMessage(message,classes){
    var body=document.getElementsByTagName("body");
    var messageDiv=document.createElement("div");
    $(messageDiv).addClass(classes+" rdfazerMessage").text(message);
    setTimeout(function(){
        $(messageDiv).addClass(classes+" rdfazerMessage-close")       
        setTimeout(function(){$(messageDiv).remove()},3000);
    },1500);
    $(body[0]).append(messageDiv);
    setTimeout(function(){
        $(messageDiv).addClass("rdfazerMessage-open");
    },0);
}

var Rdfazer = {
    currentRange:null, 
    baseURI:"http://localhost",
    //* stores the current HTML page in the rdfazer component for storing it as a source when needed. TODO use and store the HTML
    storeCurrentHTML: function() {
        this.currentHTML = document.getElementsByTagName("html")[0].outerHTML;
    },
    
    init: function(){
        var rdfazerIF = $("#rdfazerInterface")[0];
        if(rdfazerIF){
            return rdfazerIF;
        }else{
            rangy.init();

            this.addCss();
            this.addInterface();
        }
    },
    addInterface: function(){
        var self=this;
        $("body").append("<div id='rdfazerInterface'></div>");
        $('#rdfazerInterface').load(chrome.extension.getURL("interface.html"),function(){
            var rdfazer= $("#rdfazerInterface");
            $(".rdfazerhead button.switch").click(function(){
                rdfazer.toggleClass("left");
            });
            $(".rdfazerhead button.open").click(function(){
                rdfazer.toggleClass("open");
            });
            $(".rdfazerhead button.remove").click(function(){
                self.destroy();
            });
            self.addDialog();
            self.showHighlights();
        });
    },

    destroy:function(){
        $('#rdfazerInterface').remove();
        $('#rdfazerdialog').dialog('destroy').remove();
    },

    addHighlightToSelection:function(name,url,uris){
        var highlighter = rangy.createHighlighter();
        var localHighlightUri = "_:rdfazer"+(new Date()).getTime();

        highlighter.addClassApplier(rangy.createCssClassApplier("highlight", {
            ignoreWhiteSpace: true,
            elementTagName: "a",
            elementProperties: {
                href: url,
                onclick: function() {
                    var highlight = highlighter.getHighlightForElement(this);
                    if (window.confirm("Delete this highlight (URL " + url + ")?")) {
                        highlighter.removeHighlights( [highlight] );
                    }
                    return false;
                }
            },
            elementAttributes: {
                about: localHighlightUri,
                title: name
            }
        }));

        highlighter.highlightRanges("highlight",[this.currentRange]);

        this.addHighlightedConcept(localHighlightUri,uris);
    },

    addHighlightedConcept:function(localHighlightUri,uris){
        var conceptsDiv = $("#rdfazerconcepts");
        if(conceptsDiv.length==0){
            $("body").append("<div id='rdfazerconcepts' style='display:none'></div>");
            conceptsDiv = $("#rdfazerconcepts");
        }

        conceptsDiv.append("<div about='"+localHighlightUri+"'><div rel='"+this.baseURI+"/highlightFor'></div></div>");
        
        var relation = $("#rdfazerconcepts div[about='"+localHighlightUri+"'] div[rel='"+this.baseURI+"/highlightFor']");

        for(var i=0, uri; uri=uris[i]; i++){
            relation.append("<span about='"+uri+"'></span>");
        }

        this.showHighlights();
    },

    readAndAddHighlight:function(){
        var name = $("#rdfazerdialog input[name='label']").val();
        var url = $("#rdfazerdialog input[name='href']").val();
        var uriInputs = $("#rdfazerdialog input.uri");
        var uris = [];
        for(var i=0,uri;uri=uriInputs[i]; i++){
            uris.push($(uri).val());
        }
        
        this.addHighlightToSelection(name,url,uris);
    },

    addDialog:function(){
        var self=this;
	$("body").append("<div id='rdfazerdialog' title='Add new highlight'></div>");

        $('#rdfazerdialog').load(chrome.extension.getURL("dialog.html"),function(){
	    $(".rdfazer-dialog-tabs").tabs();

	    var dialog = $( "#rdfazerdialog" ).dialog({
                autoOpen: false,
                height: 500,
                width: 720,
                modal: true,
                close: function() {
                    var uriInputs = $("#rdfazerdialog input.uri");
                    for(var i=1, uri; uri=uriInputs[i];i++){
                        $(uri).remove();
                    }
                }
            });
            
            $(".rdfazerhead button.highlight").click(function(){
                self.currentRange = rangy.getSelection().getRangeAt(0);
		$("#rdfazer-search input").val(self.currentRange.toString());
		if($("#rdfazer-search").attr("aria-expanded")=="true"){
		    setTimeout(function(){
			$("#rdfazer-search input").focus();
		    },100);
		}else{
		    setTimeout(function(){
			$("#rdfazer-manual input[name='label']").focus();
		    },100);
		}
                dialog.dialog( "open" );
            });
	    
	    $("#rdfazerdialog button.highlight").click(function(){
                self.readAndAddHighlight();
                dialog.dialog( "close" );
	    });

	    $("#rdfazerdialog input[name='href']").change(function(){
		var url=$(this).val();
		url = decodeURIComponent(url);
		var uri = url.substring(url.lastIndexOf("http:"));
		if(uri && uri.length>0){
		    $("#rdfazerdialog input.uri").first().val(uri);		    
		}
	    });

            $("#rdfazerdialog button.adduri").click(function(){
                $("#rdfazerdialog .uris").append('<input type="text" value="http://localhost/show-concept/1" class="uri text ui-widget-content ui-corner-all">');
            });
            $("#rdfazerdialog button.removeuri").click(function(){
                $("#rdfazerdialog .uris").children().last().remove();
            });

	    self.setupSearch(dialog);
        });
    },

    addCss:function(){
        var link = document.createElement("link");
        link.href = chrome.extension.getURL("contentscript.css");
        link.type = "text/css";
        link.rel = "stylesheet";
        document.getElementsByTagName("head")[0].appendChild(link);
    },
    
    showHighlights:function(){
        var content = $("#rdfazerInterface .rdfazercontent");
        content.empty();
        
        var highlights = $(".highlight[about]");
	// keep track of where the highlights are and do not overlap
	var highlightSpots = [];
        
        for(var i=0, highlight; highlight=highlights[i]; i++){
            var node = $(highlight);
            var highlightURI = node.attr("about");
            var urinodes = $("#rdfazerconcepts div[about='"+highlightURI+"'] span");
            var uris = [];
            for(var j=0, uri; uri=urinodes[j]; j++){
                uris.push($(uri).attr("about"));
            }
	    var tag=this.buildHighlightTag(content,node,uris,highlightURI,highlightSpots);          
        }

    },

    buildHighlightTag:function(content,node,uris,highlightURI,highlightSpots){
	var tag=$("<a class='highlightTag' highlight= '"+highlightURI+"' href='"+node.attr("href")+"'>"+uris.join(", ")+"</a>");

	var top = node.offset().top;
	var takenSpot = null;
	while(takenSpot = this.highlightSpotTaken(highlightSpots,top)){
	    top = takenSpot.top + takenSpot.height + 3;
	}

        tag.css({ top: top+"px" });

	tag.hover(function(){
            var highlightURI=$(this).attr("highlight");
            $(".highlight[about='"+highlightURI+"']").addClass("hover");
        },function(){
            var highlightURI=$(this).attr("highlight");
            $(".highlight[about='"+highlightURI+"']").removeClass("hover");
        });

        content.append(tag);
	highlightSpots.push({top:top, height:tag.height()});
    },
    // really inefficient, but there should not be that many highlights, right...
    highlightSpotTaken:function(highlightSpots,top){
	for(var i = 0, spot; spot = highlightSpots[i]; i++){
	    if(spot.top<= top && spot.height>= top-spot.top){
		return spot;
	    }
	}
	return false;
    },

    setupSearch:function(dialog){
	var self = this;
	var search= $("#rdfazer-search .buttons input").keypress(function(e){
	    if(e.which==13){
		self.doSearch($(this).val());
	    }
	});

	$("#rdfazer-search button.highlight-searches").click(function(){
	    self.highlightAcceptedSearches();
            dialog.dialog( "close" );
	});
	$("#rdfazer-search button.clear-searches").click(function(){
	    self.clearResults(true);
	});

    },

    highlightAcceptedSearches:function(){
	var checked=$("#rdfazer-search .search-results input:checked");
	var label;
	var uris=[];
	var url;
	for( var i=0, input; input=checked[i];i++){
	    var resultDiv= input.parentNode.parentNode;
	    var result=resultDiv.searchResult;
	    label= resultDiv.searchResult[resultDiv.searchResultLabel].value;
	    var uri = result.target.value;
	    url= this.config.uriToUrl(uri);
	    uris.push(uri);		
	}
	if(uris.length>0){
	    this.addHighlightToSelection(label,url,uris);
	}
    },

    doSearch:function(searchTerm){
	var query = "";
	var self = this;
	query = this.config.query.replace("$searchTerm",searchTerm,"g");
	this.sparqlQuery(query, function(data){
	    self.showResults(data.head.vars,data.results.bindings);
	},function(){
	    self.message("error","Could not query the server for matching terms");
	});
    },

    clearResults:function(all){
	if(all){
	    $("#rdfazer-search .search-results").empty();
	    return;
	}else{
	    var unchecked=$("#rdfazer-search .search-results input:checkbox:not(:checked)");
	    for(var i = 0, check; check = unchecked[i]; i++){
		$(check.parentNode.parentNode).remove();
	    }
	}
    },

    showResults:function(vars,bindings){
	this.clearResults();
	for(var i = 0, binding; binding = bindings [i]; i++){
	    var container = $('<div class="rdfazer-searchresult">'+
			      '<div class="rdfazer-searchresult-head">'+
			      '<span class="toggle">+</span><span class="rdfazer-hcontent"></span><input type="checkbox"></input></div>' +
			      '<div class="searchresult-body hidden"></div>' + 
			      '</div>');
	    var useAsLabel;
	    if(vars.length>1){
		useAsLabel=vars[1];
	    }else{
		useAsLabel=vars[0];
	    }
	    container.find(".rdfazer-hcontent").html(binding[useAsLabel].value);
	    var details = ""

	    for(var j = 0, varname; varname = vars [j]; j++){
		details += "<div><span>"+varname+":</span><span>"+binding[varname].value+"</span></div>"
	    }    
	    container.find(".toggle").click(function(){
		$(this).parent().parent().find(".searchresult-body").toggleClass("hidden");
	    });
	    container.find(".searchresult-body").append(details);
	    $("#rdfazer-search .search-results").append(container);	    

	    container[0].searchResult = binding;
	    container[0].searchResultLabel = useAsLabel;
	}
    },

    message:function(type,message){
	alert(type+": "+message);
    },

    sparqlQuery:function(query,success,error){
	/* for the interested reader that would like to know why the headers are a mess:
	   virtuoso. */
	$.ajax({
	    headers: { 
		Accept : "application/sparql-results+json,application/json,text/html,application/xhtml+xml,application/xml; charset=utf-8",
		"Content-Type": "text/plain; charset=utf-8"
	    },
	    url:this.config.sparql,
	    data:{
		query:query,
		format:"application/sparql-results+json"
	    },
	    success:success,
	    error:error
	});
    },

    config: {
	sparql:"http://localhost:8890/sparql",
	query: "select ?target (group_concat(distinct(?labels),\", \") as ?label) (group_concat(distinct(?types), \", \") as ?type) where { { ?target a <http://ec.europa.eu/esco/model#Occupation> . } UNION { ?target a <http://ec.europa.eu/esco/model#Skill> . } ?target <http://www.w3.org/2008/05/skos-xl#prefLabel> ?thing3. ?thing3 <http://www.w3.org/2008/05/skos-xl#literalForm> ?labels . ?target <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?types .{ ?target <http://www.w3.org/2008/05/skos-xl#prefLabel> ?thing1. ?thing1 <http://www.w3.org/2008/05/skos-xl#literalForm> ?label0 . FILTER (bif:contains(?label0,\"'$searchTerm*'\")) . FILTER (lang(?label0) = \"en\") . } UNION { ?target <http://www.w3.org/2008/05/skos-xl#altLabel> ?thing2. ?thing2 <http://www.w3.org/2008/05/skos-xl#literalForm> ?label1 . FILTER (bif:contains(?label1,\"'$searchTerm*'\")) . FILTER (lang(?label1)= \"en\") . } FILTER (lang (?labels) = \"en\") } GROUP BY ?target",
	uriToUrl:function(uri){
	    return "https://ec.europa.eu/esco/web/guest/concept/-/concept/thing/en/"+uri;
	}
    }
};

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.type == "initRDFazer"){
            Rdfazer.init();
            sendResponse({status:"ok"});
        } else if(request.type == "getPageContent"){
            var htmlNodes = document.getElementsByTagName("html");
            sendResponse({html:htmlNodes[0].outerHTML});
        }
  });
