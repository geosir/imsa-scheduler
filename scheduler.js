// Get data from URL parameters
// Used for parsing schedules from URLs (this feature...is under development ;) )
function getParameterByName(name) {
    const urlParams = new URLSearchParams(window.location.search); 
    return urlParams.get(name);
}

// Make these functions available to the DOM
var updateSchedule;
var autoSchedule;
var printDiv;

// Main jquery magic.
$(document).ready(function () {
    // Schedule cell colors
    var colors = {
        "red": "rgb(255,62,62)",
        "yellow": "rgb(255,182,0)",
        "green": "rgb(0,212,85)",
        "blue": "rgb(40,144,255)",
        "purple": "rgb(155,72,208)",
        "pink": "rgb(255,85,217)",
        "brown": "rgb(136,87,12)",
        "cyan": "rgb(36,209,212)"
    };

    // Makes a reversed dictionary,
    // used to discern color name from the RGB color value
    var backcolors = invert(colors);

    // Sequence of days in PowerSchool
    var daySequence = ["A", "B", "C", "D", "E"];

    // Sequence of days in the week
    var calendarDaySequence = ["A", "B", "E", "C", "D"];

    // Removes a class from the schedule table, identified by the datastring.
    function removeFromTable(datastring) {
        var table = $("#schedule")[0];

        // Scan table, resetting cells that match.
        for (mod = 1; mod < table.rows.length; mod++) {
            for (day = 1; day < table.rows[mod].cells.length; day++) {
                // If cell has a matching datastring
                if (table.rows[mod].cells[day].getAttribute("data-schedule") === datastring) {
                    // Reset styles
                    var cell = table.rows[mod].cells[day];
                    cell.innerHTML = "";
                    cell.style.backgroundColor = "";
                    cell.style.border = "";
                    cell.removeAttribute("data-schedule");

                    // Merged cells for double-mod classes on non-I-days should be split back into separate cells
                    // But I-day cells should stay merged. Only split if the cell is not an I-day ("msi") cell.
                    if (cell.hasAttribute("rowspan") && !cell.classList.contains("msi")) {
                        var nextCell = table.rows[mod + 1].cells[day];
                        cell.removeAttribute("rowspan");
                        nextCell.style.display = "";
                        nextCell.innerHTML = "";
                        nextCell.style.backgroundColor = "";
                        nextCell.style.border = "";
                        nextCell.removeAttribute("data-schedule");
                    }
                }
            }
        }
    }

    // Add a class to the schedule table
    function addToTable(className, teacherName, roomName, mods, color) {
        var table = $("#schedule")[0];

        // Generate a datastring to identify cells corresponding to the same class.
        var datastring = className + "&#&#!" + roomName + "&#&#!" + teacherName;

        // Loop over cells and mark them as part of the class when applicable
        for (i = 0; i < mods.length; i++) {
            for (j = 0; j < mods[i].length; j++) {
                if (mods[i][j] === true) {
                    var mod = i + 1;
                    var day = j + 1;
                    table.rows[mod].cells[day].innerHTML = "<span class=\"text\"><p><b>" + className + "</b></p><p><u>" + roomName + "</u></p><p>" + teacherName + "</p></span>";
                    table.rows[mod].cells[day].setAttribute("data-schedule", datastring);
                    table.rows[mod].cells[day].style.backgroundColor = color;
                    table.rows[mod].cells[day].style.border = "1px solid transparent"
                }
            }
        }

        // Merge double-mod classes to display one big cell.
        for (mod = 1; mod < table.rows.length - 1; mod++) {
            for (day = 1; day < table.rows[mod].cells.length; day++) {
                if (table.rows[mod].cells[day].getAttribute("data-schedule") && table.rows[mod + 1].cells[day].getAttribute("data-schedule")) {
                    if (table.rows[mod].cells[day].getAttribute("data-schedule") === table.rows[mod + 1].cells[day].getAttribute("data-schedule")) {
                        if (table.rows[mod].cells[day].style.display !== "none") {
                            table.rows[mod].cells[day].setAttribute("rowspan", 2);
                            table.rows[mod + 1].cells[day].style.display = "none";
                        }
                    }

                }
            }
        }
    }

    // Grab information from the Schedule Commander, and add and remove classes as needed.
    updateSchedule = function () {
        try {
            var table = $("#mod-entry")[0];

            // Form parts
            var className = $("#class-name").val();
            var teacherName = $("#teacher-name").val();
            var roomName = $("#room-name").val();
            var pickedColor = $("#label-color").val();

            // Get selected mods from the Schedule Commander table
            var mods = [];
            for (mod = 1; mod < table.rows.length; mod++) {
                var rowSelect = [];
                for (day = 1; day < table.rows[mod].cells.length; day++) {
                    if (table.rows[mod].cells[day].classList.contains("selected")) {
                        rowSelect.push(true);
                    } else {
                        rowSelect.push(false);
                    }
                }
                mods.push(rowSelect);
            }

            // Get the RGB color for the cell
            var color = colors["red"];
            if (pickedColor) {
                color = colors[pickedColor]
            }

            // Clear entries for the selected class that are in the table (resetting the table for that class)
            var $scheduleCommand = $("#schedule-command");
            if ($scheduleCommand.attr("data-schedule")) {
                removeFromTable($scheduleCommand.attr("data-schedule"));
                $scheduleCommand.attr("data-schedule", className + "&#&#!" + roomName + "&#&#!" + teacherName);
            }

            // Add updated entries for that class into the table. The remove+add effectively implements an update.
            addToTable(className, teacherName, roomName, mods, color);

            // Show success message.
            var $success = $("#success");
            $success.css("opacity", 1);
            $success.animate({opacity: 0}, 1000);

        } catch (e) {
            // An error occurred! Show a message.
            var $messages = $("#messages");
            $messages.html("An error occured. Please let George know what happened: <a href=\"mailto:george@george.moe\" target=\"_blank\">george@george.moe</a>.");
            $messages.css("opacity", 1);
            $messages.delay(5000).animate({opacity: 0}, 2000);
            console.log(e);
        }
    };

    // Parse data from the PowerSchool textfield and update the schedule
    autoSchedule = function () {
        try {

            // Get data from the PowerSchool textfield. Split by line, and tokenize lines by tabs.
            var powerschool = $("#powerschool-entry").val();
            powerschool = powerschool.split("\n");
            // filter out lines that do not start with numbers as they cannot possibly be valid expressions.
            // this allows headers to be pasted.
            powerschool = powerschool.filter((entry) => {
               return !isNaN(entry[0]);
            })
            powerschool = powerschool.map(function (entry) {
                return entry.split("\t");
            });

            // Process each line in the PowerSchool schedule
            powerschool.forEach(function (entry) {
                // PowerSchool lines are formatted as follows:
                // Schedule Expression | something | something | Class Name | Teacher Name | Room Name
                // Map these into variables
                var expression = entry[0];
                var className = entry[3];
                var teacherName = entry[4];
                var roomName = entry[5];

                // Pick a random color
                var color = colors[Object.keys(colors)[Math.floor(Math.random() * Object.keys(colors).length)]];

                // Use regex to split the expression into mods and days.
                expression = expression.replace(/ +/g, "");
                expression = expression.split(/\),*(?=[0-9])/g);
                expression = expression.map(function (v, i, a) {
                    if (i < a.length - 1) return v + ")"; else return v;
                });

                // Process each sub-expression (mod/day pairing)
                expression.forEach(function (exp) {
                    exp = exp.replace(")", "");
                    exp = exp.split("(");

                    // Create a list of selected MODS based on the expression
                    // The "..." is a javascript spread operator, defined in EMCAScript 2015.
                    // Most modern browsers are compatible with it.
                    var selectedMods = [].concat(...exp[0].split(",").map(function (range) {
                        // Basically use the given end mods and the sequence of days defined in `daySequence`
                        // and do some naive looping to pick days. Yuck, who wrote this?? :P Oops, I did, 3 years ago :(
                        var rangeCaps = range.split("-");
                        if (rangeCaps.length >= 2) {
                            var result = [];
                            var direction = 1;
                            if (parseInt(rangeCaps[0]) > parseInt(rangeCaps[1])) {
                                direction = -1;
                            }
                            for (i = parseInt(rangeCaps[0]); i !== parseInt(rangeCaps[1]) + direction; i = i + direction) {
                                result.push(i);
                            }
                            return result;
                        } else {
                            return [parseInt(rangeCaps[0])];
                        }
                    })
                )
                    ;

                    // Create a list of selected DAYS based on the expression in a similar way as above
                    var selectedDays = [].concat(...exp[1].split(",").map(function (range) {
                        var rangeCaps = range.split("-");
                        if (rangeCaps.length >= 2) {
                            var result = [];
                            var direction = 1;
                            if (daySequence.indexOf(rangeCaps[0]) > daySequence.indexOf(rangeCaps[1])) {
                                direction = -1;
                            }
                            for (i = daySequence.indexOf(rangeCaps[0]); i !== daySequence.indexOf(rangeCaps[1]); i = i + direction) {
                                result.push(daySequence[i]);
                            }
                            result.push(rangeCaps[1]);
                            return result;
                        } else {
                            return [rangeCaps[0]];
                        }
                    })
                )
                    ;

                    // Make mod/day pairs and use those to enter the class into the schedule table.
                    var mods = [];
                    for (i = 0; i < 8; i++) {
                        var rowSelect = [];
                        for (j = 0; j < 5; j++) {
                            rowSelect.push(selectedMods.includes(i + 1) && selectedDays.includes(calendarDaySequence[j]));
                        }
                        mods.push(rowSelect);
                    }
                    if (mods[1][2] === true) {
                        mods[1][2] = false;
                        mods[2][2] = true;
                    }

                    addToTable(className, teacherName, roomName, mods, color)
                });
            });

            // Whew, we're done. Display a success message.
            var $autoSuccess = $("#auto-success");
            $autoSuccess.css("opacity", 1);
            $autoSuccess.animate({opacity: 0}, 1000);

        } catch (e) {
            // An error occurred?? Of course. Show a message.
            var $autoMessages = $("#auto-messages");
            $autoMessages.html("An error occured. Please let George know what happened: <a href=\"mailto:george@george.moe\" target=\"_blank\">george@george.moe</a>.");
            $autoMessages.css("opacity", 1);
            $autoMessages.delay(5000).animate({opacity: 0}, 2000);
            console.log(e);
        }
    };

    // Grab the table and send it to a printable page.
    printDiv = function () {
        var divToPrint = document.getElementById("areaToPrint");
        var style = document.getElementById("style");
        newWin = window.open("");
        newWin.document.write("<link rel=\"stylesheet\" type=\"text/css\" href=\"print.css\" />");
        newWin.document.write(divToPrint.outerHTML);
    };

    // Clear the schedule commander.
    resetScheduleCommand = function () {
        var table = $("#mod-entry")[0];

        //form elements
        $("#class-name").val("");
        $("#teacher-name").val("");
        $("#room-name").val("");
        $("#label-color").val("red");
        $("#mod-entry td.selected").removeClass("selected");
        $("#schedule-command").removeAttr("data-schedule");
    };

    // Process clicks on a cell in the schedule table.
    // Load data into the Schedule Commander when clicked.
    var $scheduleCell = $("#schedule td");
    $scheduleCell.click(function () {
        // Clear the schedule commander so we can load new data.
        resetScheduleCommand();

        // Get data from the schedule cell.
        var table = $("#schedule")[0];
        var modEntry = $("#mod-entry")[0];
        var data = $(this).attr("data-schedule").split("&#&#!");
        $("#schedule-command").attr("data-schedule", $(this).attr("data-schedule"));

        // Fill the Schedule Commander fields.
        $("#class-name").val(data[0]);
        $("#teacher-name").val(data[2]);
        $("#room-name").val(data[1]);

        // Get the color of the cell and map it into the selector in the Schedule Commander
        var color = backcolors[$(this).css("backgroundColor").replace(/ +/g, "")];
        $("#label-color").val(color);

        // Fill the Schedule Commander Table.
        for (mod = 1; mod < table.rows.length; mod++) {
            for (day = 1; day < table.rows[mod].cells.length; day++) {
                if (table.rows[mod].cells[day].getAttribute("data-schedule") === $(this).attr("data-schedule")) {
                    modEntry.rows[mod].cells[day].className = modEntry.rows[mod].cells[day].className + " selected";
                }
            }
        }
    });

    // Handle double-clicks on schedule cells.
    // Double-clicks delete cell entries.
    $scheduleCell.dblclick(function () {

        var table = $("#schedule")[0];

        // Clear the cell.
        this.innerHTML = "";
        this.style.backgroundColor = "";
        this.style.border = "";
        this.removeAttribute("data-schedule");

        // Split double-mod cells if it isn't in I-day ("msi") cell.
        if (this.hasAttribute("rowspan") && !this.classList.contains("msi")) {
            var nextCell = table.rows[$(this).parent().parent().children().index($(this).parent()) + 1].cells[$(this).parent().children().index($(this))];
            this.removeAttribute("rowspan");
            nextCell.style.display = "";
            nextCell.innerHTML = "";
            nextCell.style.backgroundColor = "";
            nextCell.style.border = "";
            nextCell.removeAttribute("data-schedule");
        }

    });

    // Handle clicks in the Schedule Commander. Mark which commander cells have been selected.
    $("#mod-entry td:not(.mod):not(.noclass)").click(function () {
        if ($(this).hasClass("selected")) {
            $(this).removeClass("selected");
        } else {
            $(this).addClass("selected");
        }
    });

    // Show hover colors...but this really ought to be just done in the CSS. TODO!
    $("#schedule td:not(.noclass)").hover(function () {
            this.style.border = "1px solid #1359c9"
        },
        function () {
            if (this.style.backgroundColor !== "") {
                this.style.border = "1px solid transparent";
            }
            else {
                this.style.border = "";
            }
        });

    // If there is a Schedule Code in the URL, throw it into the PowerSchool parser and schedule it.
    // This is useful for sending schedules via a link---with the data in the link.
    if (getParameterByName("scode") !== null) {
        $("#powerschool-entry").val(getParameterByName("scode"));
        autoSchedule();
    }

});

// Creates a dictionary with the keys and values swapped:
// {key: value} -> {value: key}
function invert(obj) {
    var new_obj = {};
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            new_obj[obj[prop]] = prop;
        }
    }
    return new_obj;
}
