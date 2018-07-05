/**
 * @copyright Copyright (c) 2018 Kevin Polez <kevin@hypatie.xyz>
 *
 * @author Kevin Polez <kevin@hypatie.xyz>
 *
 * @license GNU AGPL version 3 or any later version
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

 (function (OC, window, $, undefined) {
 'use strict';

 $(document).ready(function () {

 Handlebars.registerHelper('firstLetter', function( context, options) {
   return context.substring(0, 1);
 });

 var translations = {
     newReckoning: $('#new-reckoning-string').text()
 };

 // this reckonings object holds all our reckonings
 var Reckonings = function (baseUrl) {
     this._baseUrl = baseUrl;
     this._reckonings = [];
     this._activeReckoning = undefined;
 };

 Reckonings.prototype = {
     load: function (id) {
         var self = this;
         this._reckonings.forEach(function (reckoning) {
             if (reckoning.id === id) {
                 reckoning.active = true;
                 self._activeReckoning = reckoning;
                 self.compute();
             } else {
                 reckoning.active = false;
             }
         });
     },
     compute: function() {
       var self = this;
       var reckoning = self._activeReckoning;
       self._activeReckoning.total = 0;
       self._activeReckoning.participants = [];
       self._activeReckoning.balance = [];

       // total spent compute
       this._activeReckoning.lines.forEach(function(line) {
         // find if participant already exist
         var participant = self._activeReckoning.participants.find(function(element) {
           return element.name === line.who;
         });
         // if new
         if ( participant === undefined ) {
            self._activeReckoning.participants.push({
              'name': line.who,
              'total': parseFloat(line.amount)
            });
         } else { // if already exist
           participant.total += parseFloat(line.amount);
           var index = self._activeReckoning.participants.indexOf(participant);
           self._activeReckoning.participants[index] = participant;
         }
         self._activeReckoning.total += parseFloat(line.amount);
       });

       // solde compute
       var totalByParticipant = self._activeReckoning.total / self._activeReckoning.participants.length
       this._activeReckoning.participants.forEach(function(participant) {
           var index = self._activeReckoning.participants.indexOf(participant);
           participant.solde = participant.total - totalByParticipant;
           self._activeReckoning.participants[index] = participant;
       });

       // sort participants array by solde
       this._activeReckoning.participants.sort(function(a, b) {
         if ( a.solde < b.solde) return -1;
         else if ( a.solde > b.solde) return 1;
         return 0;
       });

       // balance compute
       this._activeReckoning.participants.forEach(function(participant) {
           var index = self._activeReckoning.participants.indexOf(participant);
           var futurSolde = participant.solde;

            while (futurSolde < 0 ) {
             // find a participant with a positive solde (handle previous balance line)
             var participantPositive = self._activeReckoning.participants.find(function(element) {
               var solde = element.solde;
               self._activeReckoning.balance.forEach(function(line) {
                 if (line.credit == element.name) solde -= line.amount;
               });
               return solde > 0;
             });

             // create a balance line
             if ( participantPositive.solde - Math.abs(futurSolde) >= 0 )
             {
               self._activeReckoning.balance.push({
                 'debit': participant.name,
                 'credit': participantPositive.name,
                 'amount': Math.abs(futurSolde)
               });
               futurSolde += Math.abs(futurSolde);
             }
             else {
               self._activeReckoning.balance.push({
                 'debit': participant.name,
                 'credit': participantPositive.name,
                 'amount': participantPositive.solde
               });
               futurSolde += participantPositive.solde;
             }

           }
       });
     },

     getActive: function () {
         return this._activeReckoning;
     },
     removeActive: function () {
         var index;
         var deferred = $.Deferred();
         var id = this._activeReckoning.id;
         this._reckonings.forEach(function (reckoning, counter) {
             if (reckoning.id === id) {
                 index = counter;
             }
         });

         if (index !== undefined) {
             // delete cached active reckoning if necessary
             if (this._activeReckoning === this._reckonings[index]) {
                 delete this._activeReckoning;
             }

             this._reckonings.splice(index, 1);

             $.ajax({
                 url: this._baseUrl + '/' + id,
                 method: 'DELETE'
             }).done(function () {
                 deferred.resolve();
             }).fail(function () {
                 deferred.reject();
             });
         } else {
             deferred.reject();
         }
         return deferred.promise();
     },
     create: function (reckoning) {
         var deferred = $.Deferred();
         var self = this;
         $.ajax({
             url: this._baseUrl,
             method: 'POST',
             contentType: 'application/json',
             data: JSON.stringify(reckoning)
         }).done(function (reckoning) {
             self._reckonings.push(reckoning);
             self._activeReckoning = reckoning;
             self.load(reckoning.id);
             deferred.resolve();
         }).fail(function () {
             deferred.reject();
         });
         return deferred.promise();
     },
     getAll: function () {
         return this._reckonings;
     },
     loadAll: function () {
         var deferred = $.Deferred();
         var self = this;
         $.get(this._baseUrl).done(function (reckonings) {
             self._activeReckoning = undefined;
             self._reckonings = reckonings;
             deferred.resolve();
         }).fail(function () {
             deferred.reject();
         });
         return deferred.promise();
     },
     updateActive: function (title, description) {
         var reckoning = this.getActive();
         reckoning.title = title;
         reckoning.description = description;

         return $.ajax({
             url: this._baseUrl + '/' + reckoning.id,
             method: 'PUT',
             contentType: 'application/json',
             data: JSON.stringify(reckoning)
         });
     },
     addLine: function( amount, when, who, why) {
        var deferred = $.Deferred();
        var reckoning = this.getActive();
        var self = this;
        var line = {
          'reckoningId': reckoning.id,
          'amount': amount,
          'when': when,
          'who': who,
          'why': why
        };
        $.ajax({
            url: this._baseUrl + '/' + reckoning.id + '/lines',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(line)
        }).done(function() {
          self._activeReckoning.lines.push(line);
          self.load(reckoning.id);
          deferred.resolve();
        }).fail(function() {
          deferred.reject();
        });
        return deferred.promise();
     }
 };

 // this will be the view that is used to update the html
 var View = function (reckonings) {
     this._reckonings = reckonings;
 };

 View.prototype = {
     renderContent: function () {
         var source = $('#content-tpl').html();
         var template = Handlebars.compile(source);
         var html = template({reckoning: this._reckonings.getActive()});

         $('#editor').html(html);

        var self = this;
         // handle save reckoning
         $('#app-content button.save').click(function () {
             var description = $('#app-content textarea').val();
             var title = $('#app-content input.title').val();

             self._reckonings.updateActive(title, description).done(function () {
                 self.render();
             }).fail(function () {
                 alert('Could not update reckoning, not found');
             });
         });

         // handle delete reckoning
         $('#app-content button.delete').click(function () {
             self._reckonings.removeActive().done(function () {
                 self.render();
             }).fail(function () {
                 alert('Could not update reckoning, not found');
             });
         });
     },
     renderList: function() {
       var source = $('#list-tpl').html();
       var template = Handlebars.compile(source);
       var html = template({reckoning: this._reckonings.getActive()});

       $('#list_editor').html(html);
       var self = this;

       // create an array with all participants
       var reckoning = this._reckonings.getActive();
       if ( reckoning !== undefined ) {
         var participantArray = [];
         var amountArray = [];
         var soldeArray = [];
         reckoning.participants.forEach(function(participant) {
           participantArray.push(participant.name);
           amountArray.push(participant.total);
           soldeArray.push(participant.solde);
         });

         var chartExpenseByUser = Highcharts.chart('chartExpenseByUser', {
                 chart: {
                     type: 'bar'
                 },
                 title: {
                     text: 'Expenses by user'
                 },
                 xAxis: {
                     categories: participantArray
                 },
                 yAxis: {
                     title: {
                         text: 'Euros'
                     }
                 },
                 series: [{
                     name: 'Amount',
                     data: amountArray
                 }]
             });
         var soldeByUser = Highcharts.chart('chartSoldeByUser', {
                 chart: {
                     type: 'bar'
                 },
                 title: {
                     text: 'Solde by user'
                 },
                 xAxis: {
                     categories: participantArray
                 },
                 yAxis: {
                     title: {
                         text: 'Euros'
                     }
                 },
                 plotOptions: {
                   series: {
                     className: 'main-color',
                     negativeColor: true
                   }
                 },
                 series: [{
                     name: 'Amount',
                     data: soldeArray
                 }]
             });
        }

       // show add expense form when click on a.addExpense
       $('a.addExpense').on('click',function(event){
         event.preventDefault();
         $('.addExpenseForm').toggleClass('hidden');
       });

       // show reckoning resume when click on a.resume
       $('a.resume').on('click',function(event){
         event.preventDefault();
         $('.resumeReckoning').toggleClass('hidden');
       });


       // check if amount is correct
       $('#app-content input.combien').keydown(function(event) {
         var amount = parseFloat(this.value+event.key);
         if ( isNaN(amount)) {
             $(this).removeClass('ok');
             $(this).addClass('warning');
         }
         else {
             $(this).removeClass('warning');
             $(this).addClass('ok');
         }
       });

       // handle new line
       $('#app-content button.new_line').click(function() {
            var amount = $('#app-content input.combien').val();
            var when = $('#app-content input.quand').val();
            var who = $('#app-content input.qui').val();
            var why = $('#app-content input.quoi').val();

            self._reckonings.addLine(amount, when, who, why).done(function() {
                self.render();
            }).fail(function() {
              alert('Could not add line on reckoning');
            });
       });
     },
     renderNavigation: function () {
         var source = $('#navigation-tpl').html();
         var template = Handlebars.compile(source);
         var html = template({reckonings: this._reckonings.getAll()});

         $('#app-navigation ul').html(html);

         // create a new reckoning
         var self = this;
         $('#new-reckoning').click(function () {
             var reckoning = {
                 title: translations.newReckoning,
                 content: ''
             };

             self._reckonings.create(reckoning).done(function() {
                 self.render();
                 $('#editor textarea').focus();
             }).fail(function () {
                 alert('Could not create reckoning');
             });
         });

         // delete a reckoning
         $('#app-navigation .reckoning .delete').click(function () {
             var entry = $(this).closest('.reckoning');
             entry.find('.app-navigation-entry-menu').removeClass('open');

             var id = parseInt(entry.data('id'), 10);
             self._reckonings.load(id);

             self._reckonings.removeActive().done(function () {
                 self.render();
             }).fail(function () {
                 alert('Could not delete reckoning, not found');
             });
         });

         // load a reckoning
         $('#app-navigation .reckoning > a').click(function () {
             var id = parseInt($(this).parent().data('id'), 10);
             self._reckonings.load(id);
             self.render();
             $('#editor textarea').focus();
         });
     },
     render: function () {
         this.renderNavigation();
         this.renderContent();
         this.renderList();
     }
 };

 var reckonings = new Reckonings(OC.generateUrl('/apps/sharedexpenses/reckonings'));
 var view = new View(reckonings);
 reckonings.loadAll().done(function () {
     view.render();
 }).fail(function () {
     alert('Could not load reckonings');
 });


 });

 })(OC, window, jQuery);