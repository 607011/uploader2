//-*- coding: utf-8 -*-
/*
Copyright 2012 Oliver Lau, Heise Zeitschriften Verlag

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


var Uploader = (function() {
    var smart_mode_allowed = window.File && window.FileReader && window.XMLHttpRequest,
    defaults = {
        upload_dir: "/uploaded",
        file_upload_url: "/uploader2/upload.php",
        form_upload_url: "/uploader2/form-upload.php",
        drop_area: "#filedrop",
        file_list: "#filelist",
        file_input: "#fileinput",
        upload_form: "#upload-form",
        file_input_button: "#fileinput-button",
        file_list_clear_button: "#filelist-clear-button",
        chunk_size: 100*1024, // bytes
        resume_interval: 2500, // ms
        resume_automatically: true, // automatically resume stalled uploads
        smart_mode: smart_mode_allowed
    },
    settings = defaults,
    current_upload_id = 0,
    current_form_id = 0,
    progress = {},
    monitor_timer = undefined;


    function pad(n) {
        return result = ("0" + n).slice(-2);
    }
    

    Date.prototype.toISO = function() {
        return [ this.getFullYear(), pad(this.getMonth()+1), pad(this.getDate()) ].join("") +
            "T" +
            [ pad(this.getHours()), pad(this.getMinutes()), pad(this.getSeconds()) ].join("");
    }


    function reset() {
        current_upload_id = 0;
        current_form_id = 0;
        progress = {};
        $(settings.file_list).removeClass("visible");
        $(settings.file_list_clear_button).css("display", "none");
        setTimeout(function() {
            $(settings.file_list).empty();
        }, 256);
    }


    function async_exec(f, ms) {
        ms = ms || 100;
        setTimeout(f, ms);
    }


    function uploadsInProgress() {
        return Object.keys(progress).length > 0;
    }


    function clearFileList() {
        if (uploadsInProgress()) {
            $(".ready").addClass("fadeOut");
            $(".bad").addClass("fadeOut");
            $(".aborted").addClass("fadeOut");
            setTimeout(function() { 
                $(".ready").remove();
                $(".bad").remove();
                $(".aborted").remove();
            }, 256);
        }
        else {
            reset();
        }
    }


    function styleTime(secs) {
        var hours = Math.floor(secs / 3600),
        minutes = Math.floor((secs - hours * 3600) / 60),
        seconds = Math.floor((secs - hours * 3600 - minutes * 60));
        return pad(hours) + "h" + pad(minutes) + "'" + pad(seconds) + "''";
    }


    function styleSize(n) {
        var prefixes = [ "KB", "MB", "GB" ], prefix = "bytes";
        while (n > 10240 && prefixes.length > 0) {
            n /= 1024;
            prefix = prefixes.shift();
        }
        return Math.round(n) + "&nbsp;" + prefix;
    }


    function makeChunk(file, startByte, endByte) {
        var blob = undefined;
        if (file.slice)
            blob = file.slice(startByte, endByte);
        else if (file.webkitSlice)
            blob = file.webkitSlice(startByte, endByte);
        else if (file.mozSlice)
            blob = file.mozSlice(startByte, endByte);
        return blob;
    }


    function resumeUpload(id) {
        var startByte, endByte, blob;
        progress[id].pause = false;
        progress[id].abort = false;
        $("#play-button-" + id).remove();
        $("#pause-button").clone().attr("id", "pause-button-" + id)
            .appendTo("#action-bar-" + id)
            .click(function() {
                pauseUpload(id);
            });
        startByte = progress[id].bytesSent;
        endByte = startByte + settings.chunk_size;
        if (endByte > progress[id].file.size)
            endByte = progress[id].file.size;
        blob = makeChunk(progress[id].file, startByte, endByte);
        uploadChunk(progress[id].file, blob, id, startByte, endByte);
    }


    function abortUpload(id) {
        if (confirm("Wollen Sie den Upload wirklich abbrechen?")) {
            progress[id].abort = true;
            progress[id].xhr.abort();
        }
    }


    function deleteFile(id) {
        $.ajax("delete-file.php", {
            async: true,
            data: {
                id: id,
                filename: progress[id].name
            }
        }).done(function(data) {
            $("#upload-" + id).addClass("deleted");
        });
    }
    

    function pauseUpload(id) {
        progress[id].pause = true;
        $("#pause-button-" + id).remove();
        $("#play-button").clone().attr("id", "play-button-" + id)
            .appendTo("#action-bar-" + id)
            .click(function() {
                resumeUpload(id);
            });
    }
    

    function uploadChunk(file, blob, id, startByte, endByte) {
        if (typeof progress[id] === "undefined" || progress[id].abort || progress[id].pause)
            return;
        var reader = new FileReader;
        reader.onload = function(e) {
            if (e.target.readyState == FileReader.DONE) {
                if (typeof progress[id] === "undefined")
                    return;
                var xhr = new XMLHttpRequest;
                progress[id].xhr = xhr;
                xhr.open("POST", settings.file_upload_url +
                         "?filename=" + progress[id].name +
                         "&id=" + id +
                         "&startByte=" + startByte +
                         "&endByte=" + endByte,
                         true);
                xhr.onload = function(e) {
                    var d = JSON.parse(xhr.responseText),
                    secs, throughput, i, percentage, blob, sum;
                    if (typeof progress[d.id] === "undefined")
                        return;
                    if (d.status === "ok") {
                        progress[d.id].bytesSent += d.endByte - d.startByte;
                        secs = (Date.now() - progress[d.id].startTime) / 1000;
                        if (progress[d.id].bytesSent < file.size) {
                            throughput = progress[d.id].bytesSent / secs;
                            progress[d.id].throughput.push(throughput);
                            if (progress[d.id].throughput.length > 5) {
                                progress[d.id].throughput.shift();
                                i = progress[d.id].throughput.length;
                                sum = 0;
                                while (i--)
                                    sum += progress[d.id].throughput[i];
                                progress[d.id].throughput_moving_avg =
                                    sum / progress[d.id].throughput.length;
                            }
                            percentage = Math.round(100 * progress[d.id].bytesSent / file.size);
                            $("#progressbar-" + d.id).css("width", percentage + "%");
                            $("#speed-" + d.id).html(styleSize(throughput) + "/s");
                            startByte = endByte;
                            endByte += settings.chunk_size;
                            if (endByte > file.size)
                                endByte = file.size;
                            blob = makeChunk(file, startByte, endByte);
                            uploadChunk(file, blob, id, startByte, endByte);
                        }
                        else {
                            $("#progressbar-" + d.id).addClass("ready");
                            $("#progressbar-" + d.id).css("width", "100%");
                            $("#upload-" + d.id).addClass("ready");
                            $("#speed-" + d.id).html(styleSize(file.size / secs) + "/s");
                            $("#filename-" + d.id)
                                .replaceWith("<a target=\"_blank\" " +
                                             "href=\"" + settings.upload_dir + "/" +
                                             d.filename + "\">" + d.filename + "</a>");
                            $("#eta-" + d.id).text("OK");
                            $("#action-bar-" + d.id).remove();
                            delete progress[d.id];
                        }
                    }
                    else {
                        $("#progressbar-" + d.id).addClass("bad");
                        $("#upload-" + d.id).addClass("bad");
                        $("#speed-" + d.id).replaceWith("<strong>" + d.message + "</strong>");
                        $("#action-bar-" + d.id).remove();
                        delete progress[d.id];
                    }
                };
                xhr.onabort = function(e) {
                    $("#progressbar-" + id).addClass("aborted");
                    $("#upload-" + id).addClass("aborted");
                    $("#action-bar-" + id).remove();
                    deleteFile(id);
                    delete progress[id];
                };
                xhr.onerror = function(e) {
                    $("#progressbar-" + id).addClass("bad");
                    $("#upload-" + id).addClass("bad");
                    $("#action-bar-" + id).remove();
                    deleteFile(id);
                    delete progress[id];
                };
                xhr.send(e.target.result);
            }
        };
        reader.onerror = function(e) {
            switch (e.target.error.code) {
            case e.target.error.NOT_FOUND_ERR:
                alert("Datei nicht gefunden.");
                break;
            case e.target.error.NOT_READABLE_ERR:
                alert("Datei ist nicht lesbar.");
                break;
            case e.target.error.ABORT_ERR:
                console.warn("Lesen der Datei abgebrochen.");
                break;
            default:
                alert("Beim Zugriff auf die Datei ist ein Fehler aufgetreten.");
                break;
            }
        };
        reader.onabort = function() {
            alert("Lesen der Datei abgebrochen.");
        };
        reader.readAsArrayBuffer(blob);
    }
    
    
    function upload(file) {
        var id = current_upload_id++,
        lastByte, blob,
        file_name = (typeof file.name === "undefined")
            ? (new Date).toISO() + "-" + id + ".png"
            : file.name;
        $(settings.file_list)
            .append("<li class=\"upload\" id=\"upload-" + id + "\">" +
                    "<span id=\"progress-" + id + "\" class=\"progressbar-container\">" +
                    "<span id=\"progressbar-" + id + "\" class=\"progressbar\"></span>" + 
                    "</span>" +
                    "<span id=\"action-bar-" + id + "\"></span> " +
                    "<span id=\"filename-" + id + "\">" + file_name + "</span>" +
                    " (" + styleSize(file.size) + ", " +
                    "<span id=\"speed-" + id + "\">? KB/s</span>, " +
                    "<span id=\"eta-" + id + "\">t&minus;?</span>)" +
                    "</li>");
        $("#upload-" + id).addClass("starting");
        if (settings.smart_mode) {
            $("#stop-button").clone().attr("id", "stop-button-" + id)
                .appendTo("#action-bar-" + id)
                .click(function() {
                    abortUpload(id);
                });
            $("#pause-button").clone().attr("id", "pause-button-" + id)
                .appendTo("#action-bar-" + id)
                .click(function() {
                    pauseUpload(id);
                });
            progress[id] = {
                file: file,
                name: file_name,
                startTime: Date.now(),
                bytesSent: 0,
                throughput: [],
                throughput_moving_avg: 0,
                stalledTime: undefined,
                abort: false,
                pause: false,
                xhr: null
            };
            // ersten Chunk hochladen, weitere Chunks werden via onload-Handler angestossen
            lastByte = (file.size < settings.chunk_size)? file.size : settings.chunk_size;
            blob = makeChunk(file, 0, lastByte);
            uploadChunk(file, blob, id, 0, lastByte);
        }
        else {
            $("#progressbar-" + id).css("width", "100%");
        }
        if (typeof monitor_timer === "undefined")
            monitor_timer = setInterval(monitorUploads, 1000);
    }


    /// Im Sekundentakt nachschauen, ob ein Upload ins Stocken geraten ist.
    /// Wenn ja, wird die Uploadratenanzeige optisch hervorgehoben.
    /// Die Funktion vergleicht den Durchsatz seit Start des Uploads mit dem
    /// gleitenden Mittelwert des Durchsatzes der vergangenen fuenf Bloecke.
    /// Liegt er mindestens 10 Prozent darunter, nimmt die Funktion an, dass 
    /// der Upload stockt.
    /// Wenn settings.resume_automatically == true, dann wird der Upload per
    /// resumeUpload() nach einer Wartezeit von resume_interval Millisekunden
    /// automatisch fortgesetzt.
    function monitorUploads() {
        var Threshold = 0.9,
        pending_uploads = Object.keys(progress),
        i = pending_uploads.length,
        id, secs, throughput, eta, stalled;
        if (i == 0) {
            if (monitor_timer) {
                clearInterval(monitor_timer);
                monitor_timer = undefined;
            }
        }
        else {
            while (i--) {
                id = pending_uploads[i];
                if (progress[id].pause || progress[id].abort)
                    continue;
                console.log("Checking " + id);
                secs = (Date.now() - progress[id].startTime) / 1000;
                throughput = progress[id].bytesSent / secs;
                eta = (progress[id].file.size - progress[id].bytesSent) / throughput;
                $("#eta-" + id).html("t&minus;" + styleTime(eta));
                stalled = throughput < Threshold * progress[id].throughput_moving_avg;
                if (stalled) {
                    $("#speed-" + id).css("color", "red")
                        .css("font-weight", "bold").text("stockt");
                    if (settings.resume_automatically) {
                        if (typeof progress[id].stalledTime === "undefined") {
                            progress[id].stalledTime = Date.now();
                        }
                        else {
                            if (progress[id].stalledTime + settings.resume_interval < Date.now()) {
                                pauseUpload(id);
                                async_exec(function() { resumeUpload(id); });
                                progress[id].stalledTime = Date.now();
                            }
                        }
                    }
                }
                else {
                    $("#speed-" + id).css("color", "")
                        .css("font-weight", "");
                    progress[id].stalledTime = undefined;
                }
            }
        }
    }


    function showUploads() {
        $(settings.file_list).addClass("visible");
        $(settings.file_list_clear_button).css("display", "inline");
    }


    function uploadFiles(files) {
        showUploads();
        if (typeof files === "object" && files.length > 0) {
            $.each(files, function() { upload(this); });
        }
    }


    function generateUploadForm() {
        var id = ++current_form_id;
        $("#iframe-container")
            .append("<iframe id=\"iframe-" + id + "\"" +
                    " name=\"iframe-" + id + "\"" +
                    "></iframe>" +
                    "<form action=\"" + settings.form_upload_url + "\"" +
                    " target=\"iframe-" + id + "\"" +
                    " id=\"form-" + id + "\"" +
                    " enctype=\"multipart/form-data\"" +
                    " method=\"POST\">" +
                    "<input type=\"file\" multiple name=\"files[]\"" +
                    " id=\"fileinput-" + id + "\" />" +
                    "</form>");
        $("#fileinput-" + id)
            .bind("change", function(event) {
                var files = event.target.files;
                uploadFiles(files);
                if (!settings.smart_mode) {
                    generateUploadForm();
                    event.target.form.submit();
                }
                event.preventDefault();
                return false;
            })
        $(settings.file_input_button)
            .unbind("click")
            .bind("click", function() {
                $("#fileinput-" + id).trigger("click");
            });
        $("#iframe-" + id).bind("load", { id: id }, function(event) {
            var id = event.data.id,
            iframe = document.getElementById("iframe-" + id).contentDocument;
            if (iframe.location.href !== "about:blank") {
                $(".progressbar").addClass("ready");
                $("#iframe-" + id).remove();
                $("#form-" + id).remove();
            }
        });
    }


    function pasteHandler(e) {
        var items = e.originalEvent.clipboardData.items, i;
        function isPNG(item) {
            return (item.kind === "file") && (item.type === "image/png");
        }
        function clipboardContainsPNG() {
            return (items.length > 0) && (function() {
                var i = items.length;
                while (i--)
                    if (isPNG(items[i]))
                        return true;
                return false;
            })();
        }
        if (clipboardContainsPNG()) {
            showUploads();
            i = items.length;
            while (i--) {
                if (isPNG(items[i]))
                    upload(items[i].getAsFile());
            }
        }
    }


    return {
        init: function(opts) {
            // Pruefen, ob Browser SVG darstellen kann. Wenn nicht, PNGs verwenden.
            var svgSupported = (function() {
                var svg;
                try {
                    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                } catch (e) { console.warn(e); }
                return (typeof svg !== "undefined") &&
                    (!navigator.userAgent.match(/(Safari|MSIE [5-9])/) ||
                     navigator.userAgent.match(/Chrome/));
            })();
            if (!svgSupported) {
                $("#upload-icon").replaceWith("<img id=\"upload-icon\" src=\"img/upload-icon.png\" width=\"200\" height=\"140\">");
                $("#play-button").replaceWith("<img id=\"play-button\" src=\"img/play-button.png\" width=\"12\" height=\"12\" class=\"mini-button\">");
                $("#stop-button").replaceWith("<img id=\"stop-button\" src=\"img/stop-button.png\" width=\"12\" height=\"12\" class=\"mini-button\">");
                $("#pause-button").replaceWith("<img id=\"pause-button\" src=\"img/pause-button.png\" width=\"12\" height=\"12\" class=\"mini-button\">");
            }
            
            // Site-spezifische Einstellungen aus Konfigurationsdatei lesen
            $.ajax("config.json", { async: false })
                .done(function(data) {
                    var config_opts = JSON.parse(data);
                    settings = $.extend({}, settings, config_opts);
                })
                .error(function(jqXHR, textStatus, errorThrown) {
                    console.warn([jqXHR, textStatus, errorThrown]);
                });
            // Einstellungen ggf. mit init()-Parametern ueberschreiben
            settings = $.extend({}, settings, opts);
            settings.smart_mode = settings.smart_mode && smart_mode_allowed;
            if (settings.smart_mode)
                $("#mode").css("background-image", "url(img/smart-mode-icon.png)")
                    .attr("title", "smart mode");
            else
                $("#mode").css("background-image", "url(img/dumb-mode-icon.png)")
                    .attr("title", "dumb mode");
            $("h2 > a").attr("href", settings.upload_dir);
            if (settings.smart_mode) {

                $("#filedrop-hint").html("Hochzuladende Dateien hier ablegen " +
                                         "oder durch Klicken ausw&auml;hlen. " +
                                         "<br/>" +
                                         "Grafiken aus der Zwischenablage " +
                                         "per Strg-V einf&uuml;gen.");
                $(settings.file_input)
                    .bind("change", function(event) {
                        uploadFiles(event.target.files);
                    });
                $(settings.file_input_button)
                    .click(function() {
                        $(settings.file_input).trigger("click");
                    });
                $(settings.drop_area).bind(
                    {
                        dragover: function(event) {
                            var e = event.originalEvent;
                            e.stopPropagation();
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                            $(settings.drop_area).addClass("over");
                        }
                        ,
                        dragleave: function(event) {
                            var e = event.originalEvent;
                            e.stopPropagation();
                            e.preventDefault();
                            $(settings.drop_area).removeClass("over");
                        }
                        ,
                        drop: function(event) {
                            var e = event.originalEvent;
                            e.stopPropagation();
                            e.preventDefault();
                            $(settings.drop_area).removeClass("over");
                            uploadFiles(e.dataTransfer.files);
                        }
                    }
                );
            }
            else { // fallback mode
                $("#filedrop-hint").html("Hochzuladende Dateien durch Klicken ausw&auml;hlen.");
                generateUploadForm();
            }
            $(settings.file_list_clear_button).click(clearFileList);
            $("#filedrop-hint").append("<br/><br/>Der Upload startet unmittelbar danach.");

            $(document).bind(
                {
                    paste: pasteHandler,
                    selectstart: function() { return false; }
                }
            );

        }
    };
})();
