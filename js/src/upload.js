//-*- coding: utf-8 -*-
// Copyright (c) 2012 by Oliver Lau <oliver@von-und-fuer-lau.de>
// This software is available under the Apache License 2.0.


var Uploader = (function() {
    var defaults = {
        upload_dir: "/uploaded",
        file_upload_url: "/uploader2/upload.php",
        form_upload_url: "/uploader2/form-upload.php",
        drop_area: "#filedrop",
        file_list: "#filelist",
        file_input: "#fileinput",
        upload_form: "#upload-form",
        file_input_button: "#fileinput-button",
        file_list_clear_button: "#filelist-clear-button",
        chunk_size: 100*1024,
        smart_mode: window.File && window.FileReader && window.XMLHttpRequest
    };


    var current_upload_id = 0;
    var current_form_id = 0;
    var progress = {};
    var form = {};
    var settings = defaults;


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


    function uploadsInProgress() {
        return Object.keys(progress).length > 0;
    }


    function clearFileList() {
        if (!uploadsInProgress()) {
            reset();
        }
        else {
            $(".ready").addClass("fadeOut");
            $(".bad").addClass("fadeOut");
            $(".aborted").addClass("fadeOut");
            setTimeout(function() { 
                $(".ready").remove();
                $(".bad").remove();
                $(".aborted").remove();
            }, 256);
        }
    }


    function styleSize(n) {
        var prefixes = [ "KB", "MB", "GB" ];
        var prefix = "bytes";
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
        progress[id].pause = false;
        progress[id].abort = false;
        $("#play-button-" + id).remove();
        $("#pause-button").clone().attr("id", "pause-button-" + id)
            .appendTo("#action-bar-" + id)
            .click(function() {
                pauseUpload(id);
            });
        var startByte = progress[id].bytesSent;
        var endByte = startByte + settings.chunk_size;
        if (endByte > progress[id].file.size)
            endByte = progress[id].file.size;
        var blob = makeChunk(progress[id].file, startByte, endByte);
        uploadChunk(progress[id].file, blob, id, startByte, endByte);
    }


    function abortUpload(id) {
        progress[id].abort = true;
        progress[id].xhr.abort();
    }


    function deleteFile(id) {
        $.ajax("delete-file.php", {
            async: true,
            data: {
                id: id,
                filename: progress[id].file.name
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
                         "?filename=" + file.name +
                         "&id=" + id +
                         "&startByte=" + startByte +
                         "&endByte=" + endByte,
                         true);
                xhr.onload = function(e) {
                    var d = JSON.parse(xhr.responseText);
                    if (typeof progress[d.id] === "undefined")
                        return;
                    if (d.status === "ok") {
                        progress[d.id].bytesSent += d.endByte - d.startByte;
                        var secs = 1e-3 * ((new Date).getTime() - progress[d.id].startTime);
                        if (progress[d.id].bytesSent < file.size) {
                            var percentage = 100 * progress[d.id].bytesSent / file.size;
                            $("#progressbar-" + d.id).css("width", percentage + "%");
                            $("#speed-" + d.id).html(styleSize(progress[d.id].bytesSent / secs) + "/s");
                            startByte = endByte;
                            endByte += settings.chunk_size;
                            if (endByte > file.size)
                                endByte = file.size;
                            var blob = makeChunk(file, startByte, endByte);
                            uploadChunk(file, blob, id, startByte, endByte);
                        }
                        else {
                            $("#progressbar-" + d.id).addClass("ready");
                            $("#progressbar-" + d.id).css("width", "100%");
                            $("#upload-" + d.id).addClass("ready");
                            $("#speed-" + d.id).html(styleSize(file.size / secs) + "/s");
                            $("#filename-" + d.id).replaceWith("<a target=\"_blank\" " +
                                                               "href=\"" + settings.upload_dir + "/" +
                                                               d.filename + "\">" + d.filename + "</a>"); 
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
                console.log("Lesen der Datei abgebrochen.");
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
        var id = current_upload_id;
        ++current_upload_id;
        $(settings.file_list)
            .append("<li class=\"upload\" id=\"upload-" + id + "\">" +
                    "<span id=\"progress-" + id + "\" class=\"progressbar-container\">" +
                    "<span id=\"progressbar-" + id + "\" class=\"progressbar\"></span>" + 
                    "</span>" +
                    "<span id=\"action-bar-" + id + "\"></span> " +
                    "<span id=\"filename-" + id + "\">" + file.name + "</span>" +
                    " (" + styleSize(file.size) + ", " +
                    "<span id=\"speed-" + id + "\">? KB/s</span>)" +
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
                startTime: (new Date).getTime(),
                bytesSent: 0,
                abort: false,
                pause: false,
                xhr: null
            };
            // ersten Chunk hochladen, weitere Chunks werden via onload-Handler angestossen
            var lastByte = (file.size < settings.chunk_size)? file.size : settings.chunk_size;
            var blob = makeChunk(file, 0, lastByte);
            uploadChunk(file, blob, id, 0, lastByte);
        }
        else {
            $("#progressbar-" + id).css("width", "100%");
        }
    }


    function uploadFiles(files) {
        if (files.length > 0) {
            $(settings.file_list).addClass("visible");
            $(settings.file_list_clear_button).css("display", "inline");
            $.each(files, function() { upload(this); });
            if (!settings.smart_mode) {
                var id = current_form_id;
                $("#form-" + id).submit();
                generateUploadForm();
            }
        }
    }


    function generateUploadForm() {
        ++current_form_id;
        var id = current_form_id;
        $("#iframe-container")
            .append("<iframe id=\"iframe-" + id + "\" name=\"iframe-" + id + "\"></iframe>" +
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
                uploadFiles(event.originalEvent.target.files);
            });
        // Auswahl-Knopf mit neuem Formular verbinden
        $(settings.file_input_button).unbind("click");
        $(settings.file_input_button)
            .bind("click", function() {
                $("#fileinput-" + id).trigger("click");
            });
        // $("#iframe-" + id).ready(function() { ... }) feuert immer, darum alternativ:
        $("#iframe-" + id).bind("load", { id: id }, function(event) {
            $(".progressbar").addClass("ready");
            $("#iframe-" + event.data.id).remove();
            $("#form-" + event.data.id).remove();
        });
    }


    return {
        init: function(opts) {
            // Pruefen, ob Browser SVG darstellen kann. Wenn nicht, PNGs verwenden.
            var svgSupported = (function() {
                var svg;
                try {
                    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                } catch (e) { console.log(e); }
                return typeof svg !== "undefined" ||
                    (navigator.userAgent.match(/(Safari|MSIE [5-9])/)
                     && !navigator.userAgent.match(/Chrome/));
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
                    console.log([jqXHR, textStatus, errorThrown]);
                });
            // Einstellungen ggf. mit init()-Parametern ueberschreiben
            settings = $.extend({}, settings, opts);
            $("h2 > a").attr("href", settings.upload_dir);
            if (settings.smart_mode) {
                $("#filedrop-hint").html("Hochzuladende Dateien hier ablegen " +
                                         "oder durch Klicken ausw&auml;hlen");
                $(settings.file_input)
                    .bind("change", function(event) {
                        uploadFiles(event.originalEvent.target.files);
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
            else { // fallback
                $("#filedrop-hint").html("Hochzuladende Dateien durch Klicken ausw&auml;hlen");
                generateUploadForm();
            }
            $(settings.file_list_clear_button)
                .click(function() {
                    clearFileList();
                });
            $("#filedrop-hint").append(".<br/>Upload startet sofort nach der Auswahl.");
        }
    };
})();
